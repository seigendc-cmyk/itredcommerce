// Console-operator action: issue a signed TerminalActivationToken (DL-039
// layer 3) for a specific tenant/terminal, and optionally mark the
// activation_request it fulfills. See DL-041 (issuance is a console-only
// action, never automated), DL-046 (the signing scheme itself), DL-048
// (keyId-based key rotation support and the 30-day default validity), and
// DL-054 (this function's signing/persist logic moved into
// _shared/terminalTokenIssuance.ts so console-confirm-invoice-payment's
// payment-triggered renewal can reuse it instead of duplicating it).
//
// Needs the service-role key (to write terminal_activation_tokens /
// activation_requests, neither of which grants any authenticated write) and
// the private signing key (a secret only this function ever touches) — so
// this cannot be a direct client write, unlike plan_components/
// tenant_subscriptions.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importSigningKey, signAndPersistTerminalActivationToken } from '../_shared/terminalTokenIssuance.ts';

// DL-048: default validity when the caller doesn't specify one.
//
// PLACEHOLDER — 30 days is a stand-in, not a final answer, for this
// MANUAL/WhatsApp-triggered issuance path specifically. Payment-triggered
// renewal (DL-054, console-confirm-invoice-payment) now computes an exact
// expiresAt from the paid invoice's own period_end instead of this
// constant — but this function is still reachable independently of a
// billing cycle (e.g. issuing a fresh terminal's very first token before
// any invoice exists), so the placeholder remains here for that case.
// TODO: revisit whether this path should also derive validity from the
// tenant's billing_cycle (DL-052) rather than a flat 30 days, once there's
// a concrete reason to (e.g. a tenant on an annual cycle requesting a
// first-ever token outside the payment-confirmation flow).
const DEFAULT_VALIDITY_DAYS = 30;

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
  const requestedValidityDays = Number(body.validityDays);
  const validityDays = Number.isFinite(requestedValidityDays) && requestedValidityDays > 0
    ? requestedValidityDays
    : DEFAULT_VALIDITY_DAYS;
  if (!tenantId || !terminalId || !planTier) {
    return json({ error: 'tenantId, terminalId and planTier are required' }, 400);
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

  // 2-3. Sign and persist (DL-054: shared with console-confirm-invoice-payment).
  let signingKey: CryptoKey;
  try {
    signingKey = await importSigningKey();
  } catch (e) {
    console.error('[console-issue-terminal-activation-token] failed to import signing key:', e);
    return json({ error: 'Temporarily unavailable' }, 502);
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + validityDays * 24 * 60 * 60 * 1000);
  let issued;
  try {
    issued = await signAndPersistTerminalActivationToken(admin, signingKey, {
      tenantId,
      terminalId,
      planTier,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      issuedBy: operator.email,
    });
  } catch (e) {
    console.error('[console-issue-terminal-activation-token] insert failed:', e);
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

  return json({ id: issued.id, token: issued.token, expiresAt: issued.expiresAt });
});
