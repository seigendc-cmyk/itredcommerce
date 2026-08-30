// Executive PWA sign-in — the piece Prompt 5 explicitly deferred to
// "whichever prompt builds the Executive/Rider PWA": bridges verify_staff_pin
// (PIN check, no Supabase Auth identity involved) to a real Supabase Auth
// session (needed because this PWA has no backend of its own and reads
// Supabase directly, RLS-protected). See DL-013.
//
// Flow: verify the PIN via the SECURITY DEFINER RPC (pin_hash never leaves
// Postgres) -> reject anything that isn't an executive -> ensure the staff
// row has an auth.users identity (provisioning one just-in-time with a
// synthetic, never-surfaced email + random password if this is the first
// time) -> mint a real session for that identity server-side via
// generateLink + verifyOtp, so the PWA user only ever sees a PIN pad, never
// a magic-link/redirect UX.
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

function syntheticEmail(tenantId: string, staffId: string): string {
  return `${staffId}@${tenantId}.execpwa.internal`.toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: { tenantId?: string; staffId?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { tenantId, staffId, pin } = body;
  if (!tenantId || !staffId || !pin) {
    return json({ error: 'tenantId, staffId and pin are required' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // 1. PIN verification (Prompt 5's shared primitive — same RPC the Express
  // backend uses for the Tauri apps).
  const { data: rpcData, error: rpcError } = await admin.rpc('verify_staff_pin', {
    p_tenant_id: tenantId,
    p_staff_id: staffId,
    p_pin: pin,
  });
  if (rpcError) {
    console.error('[executive-signin] verify_staff_pin call failed:', rpcError);
    return json({ error: 'Sign-in temporarily unavailable' }, 502);
  }
  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!row) return json({ error: 'Sign-in temporarily unavailable' }, 502);
  if (row.status === 'LOCKED_OUT') return json({ error: 'Too many failed attempts. Try again shortly.', code: 'LOCKED_OUT' }, 429);
  if (row.status !== 'OK') return json({ error: 'Invalid staff PIN', code: 'INVALID_CREDENTIALS' }, 401);

  // 2. This endpoint only ever issues executive sessions — till/head-office/
  // rider staff entering a correct PIN here still get refused, cleanly.
  if (row.access_role !== 'executive') {
    return json({ error: 'This app is only available to executive-role staff', code: 'NOT_EXECUTIVE' }, 403);
  }

  const email = syntheticEmail(tenantId, row.id);

  // 3. Ensure an auth.users identity exists for this staff row, linked via
  // staff.auth_user_id (added, unpopulated, in Prompt 5). The password here
  // is never surfaced to anyone — real auth is the PIN check above; this
  // identity is only a vehicle for obtaining a Supabase session.
  const { data: staffRow, error: staffErr } = await admin
    .from('staff')
    .select('auth_user_id')
    .eq('tenant_id', tenantId)
    .eq('id', row.id)
    .single();
  if (staffErr) {
    console.error('[executive-signin] staff lookup failed:', staffErr);
    return json({ error: 'Sign-in temporarily unavailable' }, 502);
  }

  if (!staffRow.auth_user_id) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID() + crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { staff_id: row.id, tenant_id: tenantId },
    });
    if (createErr || !created.user) {
      console.error('[executive-signin] auth user provisioning failed:', createErr);
      return json({ error: 'Sign-in temporarily unavailable' }, 502);
    }
    const { error: linkErr } = await admin
      .from('staff')
      .update({ auth_user_id: created.user.id })
      .eq('tenant_id', tenantId)
      .eq('id', row.id);
    if (linkErr) {
      console.error('[executive-signin] failed to link auth_user_id:', linkErr);
      return json({ error: 'Sign-in temporarily unavailable' }, 502);
    }
  }

  // 4. Mint a real session server-side — generateLink + verifyOtp in the
  // same call, so the user never sees a magic-link/redirect UX, only the
  // PIN pad they already used.
  const { data: linkData, error: linkGenErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkGenErr || !linkData.properties?.hashed_token) {
    console.error('[executive-signin] generateLink failed:', linkGenErr);
    return json({ error: 'Sign-in temporarily unavailable' }, 502);
  }

  const { data: verified, error: verifyErr } = await admin.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !verified.session) {
    console.error('[executive-signin] verifyOtp failed:', verifyErr);
    return json({ error: 'Sign-in temporarily unavailable' }, 502);
  }

  return json({
    accessToken: verified.session.access_token,
    refreshToken: verified.session.refresh_token,
    staff: {
      id: row.id,
      name: row.name,
      roleTitle: row.role_title,
      avatarInitials: row.avatar_initials,
    },
  });
});
