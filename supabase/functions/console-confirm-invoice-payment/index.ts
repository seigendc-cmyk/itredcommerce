// Console-operator action: confirm a billing_invoices payment and, on
// success, renew a TerminalActivationToken for every one of the tenant's
// terminals (DL-054 — Prompt 15 section 3's TerminalActivationToken
// linkage). Replaces the old direct client update(status, paid_at,
// payment_reference) on billing_invoices — that RLS grant is revoked
// (see the migration accompanying this function) so payment confirmation
// and renewal always happen together, atomically, from one place. An
// operator can no longer mark an invoice paid without the corresponding
// renewal happening, which the old direct-update path allowed by omission.
//
// Payment verification goes through the abstracted PaymentProvider
// (_shared/paymentProvider.ts, DL-054) rather than any hardcoded
// aggregator SDK — DL-044's aggregator choice is still unresolved, and the
// only concrete provider today (ManualPaymentProvider) trusts the
// operator's own confirmation, the same trust assumption the direct-update
// path it replaces already made.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importSigningKey, signAndPersistTerminalActivationToken } from '../_shared/terminalTokenIssuance.ts';
import { getPaymentProvider } from '../_shared/paymentProvider.ts';

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

  let body: { invoiceId?: string; paymentReference?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { invoiceId, paymentReference } = body;
  if (!invoiceId || !paymentReference?.trim()) {
    return json({ error: 'invoiceId and paymentReference are required' }, 400);
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
    .select('id, email, is_active')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (operatorErr) {
    console.error('[console-confirm-invoice-payment] operator lookup failed:', operatorErr);
    return json({ error: 'Temporarily unavailable' }, 502);
  }
  if (!operator || !operator.is_active) return json({ error: 'Not a console operator' }, 403);

  // 1. Load the invoice and guard against re-confirming an already-paid one.
  const { data: invoice, error: invoiceErr } = await admin
    .from('billing_invoices')
    .select('id, tenant_id, status, total, currency, period_start, period_end')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invoiceErr) {
    console.error('[console-confirm-invoice-payment] invoice read failed:', invoiceErr);
    return json({ error: 'Temporarily unavailable' }, 502);
  }
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.status === 'paid') return json({ error: 'This invoice is already paid' }, 400);

  // 2. Verify payment through the abstracted provider (DL-054/DL-044).
  const provider = getPaymentProvider();
  const confirmation = await provider.confirmPayment({
    invoiceId: invoice.id,
    amount: invoice.total,
    currency: invoice.currency,
    reference: paymentReference.trim(),
  });
  if (!confirmation.confirmed) {
    return json({ error: confirmation.reason ?? 'Payment could not be confirmed' }, 400);
  }

  // 3. Mark paid.
  const paidAt = new Date().toISOString();
  const { error: markPaidErr } = await admin
    .from('billing_invoices')
    .update({ status: 'paid', paid_at: paidAt, payment_reference: paymentReference.trim() })
    .eq('id', invoiceId);
  if (markPaidErr) {
    console.error('[console-confirm-invoice-payment] mark-paid update failed:', markPaidErr);
    return json({ error: 'Failed to record payment' }, 502);
  }

  // 4. Renew a TerminalActivationToken for every one of the tenant's
  // terminals, expiring exactly when the paid period ends (DL-054) —
  // not the DL-048 30-day placeholder, since this path has a real,
  // paid-for period length to use instead. Invoices generated before
  // DL-052 (no stored period_end) skip renewal entirely rather than
  // guessing an expiry — payment is still recorded either way.
  if (!invoice.period_end) {
    return json({
      id: invoice.id,
      status: 'paid',
      paidAt,
      renewed: false,
      reason: 'This invoice has no stored period_end (predates DL-052) — renewal skipped',
      terminalsRenewed: [],
    });
  }

  const { data: licenseKey, error: licenseKeyErr } = await admin
    .from('license_keys')
    .select('plan_tier')
    .eq('tenant_id', invoice.tenant_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (licenseKeyErr) {
    console.error('[console-confirm-invoice-payment] license_keys read failed:', licenseKeyErr);
    return json({ error: 'Payment recorded, but renewal lookup failed — temporarily unavailable' }, 502);
  }
  if (!licenseKey) {
    return json({
      id: invoice.id,
      status: 'paid',
      paidAt,
      renewed: false,
      reason: 'No license_keys row found for this tenant — cannot determine plan_tier for renewal',
      terminalsRenewed: [],
    });
  }

  const { data: terminals, error: terminalsErr } = await admin
    .from('terminals')
    .select('id')
    .eq('tenant_id', invoice.tenant_id);
  if (terminalsErr) {
    console.error('[console-confirm-invoice-payment] terminals read failed:', terminalsErr);
    return json({ error: 'Payment recorded, but renewal lookup failed — temporarily unavailable' }, 502);
  }

  let signingKey: CryptoKey;
  try {
    signingKey = await importSigningKey();
  } catch (e) {
    console.error('[console-confirm-invoice-payment] failed to import signing key:', e);
    return json({ error: 'Payment recorded, but token signing is temporarily unavailable' }, 502);
  }

  const issuedAt = new Date().toISOString();
  const terminalsRenewed: { terminalId: string; token: string; expiresAt: string }[] = [];
  for (const terminal of terminals ?? []) {
    try {
      const issued = await signAndPersistTerminalActivationToken(admin, signingKey, {
        tenantId: invoice.tenant_id,
        terminalId: terminal.id,
        planTier: licenseKey.plan_tier,
        issuedAt,
        expiresAt: invoice.period_end,
        issuedBy: operator.email,
      });
      terminalsRenewed.push({ terminalId: terminal.id, token: issued.token, expiresAt: issued.expiresAt });
    } catch (e) {
      // One terminal's issuance failing shouldn't roll back payment
      // confirmation or the renewals that already succeeded — log and
      // continue, same "don't fail the whole request over a secondary
      // step" discipline as the activation_request fulfillment update in
      // console-issue-terminal-activation-token.
      console.error(`[console-confirm-invoice-payment] renewal failed for terminal ${terminal.id}:`, e);
    }
  }

  return json({
    id: invoice.id,
    status: 'paid',
    paidAt,
    renewed: true,
    periodEnd: invoice.period_end,
    terminalsRenewed,
  });
});
