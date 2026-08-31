// Rider PWA roster endpoint — unauthenticated by design, same
// acceptable-exposure shape as executive-roster/GET /auth/staff.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const tenantId = new URL(req.url).searchParams.get('tenantId');
  if (!tenantId) return json({ error: 'tenantId is required' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await admin
    .from('staff')
    .select('id, name, avatar_initials, role_title')
    .eq('tenant_id', tenantId)
    .eq('access_role', 'rider')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[rider-roster] query failed:', error);
    return json({ error: 'Failed to load roster' }, 502);
  }

  return json(
    (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      avatarInitials: row.avatar_initials,
      roleTitle: row.role_title,
    }))
  );
});
