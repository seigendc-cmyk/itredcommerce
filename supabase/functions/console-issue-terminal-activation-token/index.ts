// Console-operator action: issue a signed TerminalActivationToken (DL-039
// layer 3) for a specific tenant/terminal, and optionally mark the
// activation_request it fulfills. See DL-041 (issuance is a console-only
// action, never automated) and DL-046 (the signing scheme itself).
//
// Needs the service-role key (to write terminal_activation_tokens /
// activation_requests, neither of which grants any authenticated write) and
// the private signing key (a secret only this function ever touches) — so
// this cannot be a direct client write, unlike plan_components/
// tenant_subscriptions.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// PREFIX-<epoch-ms>-<random> — same shape as server/lib/ids.ts's
// generateId(), but a random suffix rather than an in-process counter,
// since a stateless Edge Function invocation has no counter to keep and a
// counter wouldn't be collision-safe across concurrent invocations anyway.
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const callerJwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!callerJwt) return json({ error: 'Missing Authorization header' }, 401);

  let body: {
    tenantId?: string;
    terminalId?: string;
    planTier?: string;
    validityDays?: number;
    activationRequestId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { tenantId, terminalId, planTier, activationRequestId } = body;
  const validityDays = Number(body.validityDays);
  if (!tenantId || !terminalId || !planTier || !Number.isFinite(validityDays) || validityDays <= 0) {
    return json({ error: 'tenantId, terminalId, planTier and a positive validityDays are required' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // 1. Confirm the caller is a real, active console operator. Every RLS
  // policy in this schema already gates on app_is_super_admin(), but a
  // service-role client bypasses RLS entirely — this function must do its
  // own equivalent check before touching anything.
  const { data: userData, error: userErr } = await admin.auth.getUser(callerJwt);
  if (userErr || !userData.user) return json({ error: 'Not authenticated' }, 401);

  const { data: operator, error: operatorErr } = await admin
    .from('console_operators')
    .select('id, email, is_active')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (operatorErr) {
    console.error('[console-issue-terminal-activation-token] operator lookup failed:', operatorErr);
    return json({ error: 'Temporarily unavailable' }, 502);
  }
  if (!operator || !operator.is_active) return json({ error: 'Not a console operator' }, 403);

  // 2. Sign the payload. The private key never leaves this function; the
  // corresponding public key is committed as a constant in
  // server/lib/terminalActivationToken.ts for offline, terminal-side
  // verification (DL-046).
  const privateKeyPem = Deno.env.get('TERMINAL_TOKEN_SIGNING_PRIVATE_KEY');
  if (!privateKeyPem) {
    console.error('[console-issue-terminal-activation-token] TERMINAL_TOKEN_SIGNING_PRIVATE_KEY is not configured');
    return json({ error: 'Temporarily unavailable' }, 502);
  }

  const pemBody = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const pkcs8Der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  let signingKey: CryptoKey;
  try {
    signingKey = await crypto.subtle.importKey(
      'pkcs8',
      pkcs8Der,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  } catch (e) {
    console.error('[console-issue-terminal-activation-token] failed to import signing key:', e);
    return json({ error: 'Temporarily unavailable' }, 502);
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + validityDays * 24 * 60 * 60 * 1000);
  const payload = { tenantId, terminalId, planTier, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, payloadBytes);
  const token = `${b64url(payloadBytes.buffer)}.${b64url(signature)}`;

  // 3. Persist. `signature` holds the full compact token string — the
  // actual cryptographic credential (see the schema migration's own column
  // comment) — never re-exposed by any select grant given to authenticated
  // clients (this function's response, returned once, is the only place
  // the operator ever sees it).
  const id = generateId('TAT');
  const { error: insertErr } = await admin.from('terminal_activation_tokens').insert({
    id,
    tenant_id: tenantId,
    terminal_id: terminalId,
    plan_tier: planTier,
    issued_at: payload.issuedAt,
    expires_at: payload.expiresAt,
    signature: token,
    status: 'active',
    issued_by: operator.email,
  });
  if (insertErr) {
    console.error('[console-issue-terminal-activation-token] insert failed:', insertErr);
    return json({ error: 'Failed to issue token' }, 502);
  }

  // 4. Optionally mark the activation_request this fulfills, in the same
  // call — trusted fulfilled_by attribution the client could not assert on
  // its own (DL-041/DL-042's two-ledger reconciliation).
  if (activationRequestId) {
    const { error: fulfillErr } = await admin
      .from('activation_requests')
      .update({ fulfillment_status: 'fulfilled', fulfilled_by: operator.email, fulfilled_at: new Date().toISOString() })
      .eq('id', activationRequestId)
      .eq('tenant_id', tenantId);
    if (fulfillErr) {
      console.error('[console-issue-terminal-activation-token] activation_request fulfillment update failed:', fulfillErr);
      // The token itself is already issued and durable — don't fail the
      // whole request over a bookkeeping update; the console UI's
      // activation-requests list will simply still show it pending.
    }
  }

  return json({ id, token, expiresAt: payload.expiresAt });
});
