// Rider PWA sign-in (Prompt 9) — same bridge shape as executive-signin
// (DL-013): verify_staff_pin (no Supabase Auth identity involved) ->
// reject anything that isn't a rider -> just-in-time provision an
// auth.users identity if this is the first sign-in -> mint a real session
// server-side so the PWA user only ever sees a PIN pad.
//
// One extra step executive-signin didn't need: a rider also needs a row in
// `riders` (Prompt 7's data model) to accept jobs and share location — that
// table has no onboarding UI yet, so this endpoint also JIT-provisions a
// minimal riders row the first time a rider-role staff member signs in
// here, exactly like it JIT-provisions the auth.users identity.
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
  return `${staffId}@${tenantId}.riderpwa.internal`.toLowerCase();
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

  // 1. PIN verification (Prompt 5's shared primitive).
  const { data: rpcData, error: rpcError } = await admin.rpc('verify_staff_pin', {
    p_tenant_id: tenantId,
    p_staff_id: staffId,
    p_pin: pin,
  });
  if (rpcError) {
    console.error('[rider-signin] verify_staff_pin call failed:', rpcError);
    return json({ error: 'Sign-in temporarily unavailable' }, 502);
  }
  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!row) return json({ error: 'Sign-in temporarily unavailable' }, 502);
  if (row.status === 'LOCKED_OUT') return json({ error: 'Too many failed attempts. Try again shortly.', code: 'LOCKED_OUT' }, 429);
  if (row.status !== 'OK') return json({ error: 'Invalid staff PIN', code: 'INVALID_CREDENTIALS' }, 401);

  // 2. This endpoint only ever issues rider sessions.
  if (row.access_role !== 'rider') {
    return json({ error: 'This app is only available to rider-role staff', code: 'NOT_RIDER' }, 403);
  }

  const email = syntheticEmail(tenantId, row.id);

  // 3. Ensure an auth.users identity exists, linked via staff.auth_user_id.
  const { data: staffRow, error: staffErr } = await admin
    .from('staff')
    .select('auth_user_id')
    .eq('tenant_id', tenantId)
    .eq('id', row.id)
    .single();
  if (staffErr) {
    console.error('[rider-signin] staff lookup failed:', staffErr);
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
      console.error('[rider-signin] auth user provisioning failed:', createErr);
      return json({ error: 'Sign-in temporarily unavailable' }, 502);
    }
    const { error: linkErr } = await admin
      .from('staff')
      .update({ auth_user_id: created.user.id })
      .eq('tenant_id', tenantId)
      .eq('id', row.id);
    if (linkErr) {
      console.error('[rider-signin] failed to link auth_user_id:', linkErr);
      return json({ error: 'Sign-in temporarily unavailable' }, 502);
    }
  }

  // 4. Ensure a riders profile row exists — JIT-provisioned the same way,
  // since there's no separate rider-onboarding UI (Prompt 7 built the data
  // model only). Starts OFF/unavailable and with a placeholder vehicle
  // type; a rider corrects their own vehicle type via the PWA if needed.
  const { data: riderRow, error: riderLookupErr } = await admin
    .from('riders')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('staff_id', row.id)
    .maybeSingle();
  if (riderLookupErr) {
    console.error('[rider-signin] rider profile lookup failed:', riderLookupErr);
    return json({ error: 'Sign-in temporarily unavailable' }, 502);
  }

  let riderId = riderRow?.id as string | undefined;
  if (!riderId) {
    riderId = `RIDER-${row.id}`;
    const { error: riderInsertErr } = await admin.from('riders').insert({
      id: riderId,
      tenant_id: tenantId,
      staff_id: row.id,
      vehicle_type: 'motorbike',
      status: 'ACTIVE',
      is_available: false,
    });
    if (riderInsertErr) {
      console.error('[rider-signin] rider profile provisioning failed:', riderInsertErr);
      return json({ error: 'Sign-in temporarily unavailable' }, 502);
    }
  }

  // 5. Mint a real session server-side.
  const { data: linkData, error: linkGenErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkGenErr || !linkData.properties?.hashed_token) {
    console.error('[rider-signin] generateLink failed:', linkGenErr);
    return json({ error: 'Sign-in temporarily unavailable' }, 502);
  }

  const { data: verified, error: verifyErr } = await admin.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !verified.session) {
    console.error('[rider-signin] verifyOtp failed:', verifyErr);
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
    riderId,
  });
});
