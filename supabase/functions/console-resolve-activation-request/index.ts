// Console-operator action: resolve an activation_request without
// necessarily issuing a token (e.g. rejecting spam, or marking one handled
// outside the token flow). See DL-041. Needs trusted fulfilled_by
// attribution the client cannot assert on its own, which is why this is an
// Edge Function rather than a direct RLS-gated update — the same reasoning
// as console-issue-terminal-activation-token.
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

const ALLOWED_STATUSES = new Set(['fulfilled', 'rejected']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const callerJwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!callerJwt) return json({ error: 'Missing Authorization header' }, 401);

  let body: { activationRequestId?: string; fulfillmentStatus?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { activationRequestId, fulfillmentStatus } = body;
  if (!activationRequestId || !fulfillmentStatus || !ALLOWED_STATUSES.has(fulfillmentStatus)) {
    return json({ error: "activationRequestId and fulfillmentStatus ('fulfilled'|'rejected') are required" }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const { data: userData, error: userErr } = await admin.auth.getUser(callerJwt);
  if (userErr || !userData.user) return json({ error: 'Not authenticated' }, 401);

  const { data: operator, error: operatorErr } = await admin
    .from('console_operators')
    .select('email, is_active')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (operatorErr) {
    console.error('[console-resolve-activation-request] operator lookup failed:', operatorErr);
    return json({ error: 'Temporarily unavailable' }, 502);
  }
  if (!operator || !operator.is_active) return json({ error: 'Not a console operator' }, 403);

  const { data: updated, error: updateErr } = await admin
    .from('activation_requests')
    .update({ fulfillment_status: fulfillmentStatus, fulfilled_by: operator.email, fulfilled_at: new Date().toISOString() })
    .eq('id', activationRequestId)
    .select('id')
    .maybeSingle();
  if (updateErr) {
    console.error('[console-resolve-activation-request] update failed:', updateErr);
    return json({ error: 'Failed to update activation request' }, 502);
  }
  if (!updated) return json({ error: 'Activation request not found' }, 404);

  return json({ id: updated.id, fulfillmentStatus });
});
