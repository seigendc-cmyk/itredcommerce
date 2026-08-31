// WhatsApp Business Cloud API sender (Prompt 10) — the ONLY place a Meta
// access token is ever held (WHATSAPP_ACCESS_TOKEN, an Edge Function
// secret, never shipped to any client). Invoked by
// trigger_whatsapp_notification_drain() (supabase/migrations/
// 20260831150000_whatsapp_notifications.sql), a pg_cron job that fires
// every minute via pg_net — never by a browser or the till/head-office
// Express backend directly, per the prompt's own requirement.
//
// Drains delivery_notifications rows left PENDING by the enqueue_delivery_
// notification() trigger, oldest first, in small batches. Always sends
// `type: "template"` — see that migration's header comment for why
// free-form text is never an option here.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { WHATSAPP_TEMPLATES } from './templates.ts';

const BATCH_SIZE = 25;
// Same 3-attempt convention as the confirmation-code lockout
// (server/lib/deliveryCode.ts) — not because the two are related, just a
// consistent, already-established bound rather than inventing a new one.
const MAX_ATTEMPTS = 3;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// No guessed country code: a phone number stored without a leading '+' is
// ambiguous (which country's local-dialing convention applies?), and
// guessing wrong sends nobody's message anywhere while looking like
// success. Fail into the audit log (status SKIPPED) instead so the
// underlying phone data gets fixed at the source.
function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+')) return null;
  const digits = trimmed.replace(/[^\d+]/g, '');
  return /^\+\d{8,15}$/.test(digits) ? digits : null;
}

interface NotificationRow {
  id: string;
  tenant_id: string;
  recipient_phone: string | null;
  template_key: string;
  template_params: Record<string, unknown> | null;
  attempt_count: number;
}

Deno.serve(async (req) => {
  const secret = req.headers.get('x-drain-secret');
  if (!secret || secret !== Deno.env.get('WHATSAPP_DRAIN_SECRET')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const apiVersion = Deno.env.get('WHATSAPP_API_VERSION') || 'v20.0';

  const { data: rows, error } = await admin
    .from('delivery_notifications')
    .select('id, tenant_id, recipient_phone, template_key, template_params, attempt_count')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[whatsapp-notify] failed to load pending notifications:', error);
    return json({ error: 'Failed to load notifications' }, 500);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let deferred = 0;

  for (const row of (rows ?? []) as NotificationRow[]) {
    const updateRow = (patch: Record<string, unknown>) =>
      admin.from('delivery_notifications').update(patch).eq('tenant_id', row.tenant_id).eq('id', row.id);

    const phone = normalizeWhatsAppPhone(row.recipient_phone);
    if (!phone) {
      await updateRow({ status: 'SKIPPED', error_message: 'No valid E.164 recipient phone on file' });
      skipped++;
      continue;
    }

    const template = WHATSAPP_TEMPLATES[row.template_key];
    if (!template) {
      await updateRow({ status: 'FAILED', error_message: `Unknown template key: ${row.template_key}` });
      failed++;
      continue;
    }

    if (!accessToken || !phoneNumberId) {
      // Meta credentials not configured yet (deployment step pending) —
      // leave PENDING and try again next sweep rather than burning an
      // attempt on a config problem, not a send problem.
      deferred++;
      continue;
    }

    const params = row.template_params ?? {};
    const parameters = template.paramOrder.map((key) => ({ type: 'text', text: String(params[key] ?? '') }));

    try {
      const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: template.metaTemplateName,
            language: { code: template.languageCode },
            components: [{ type: 'body', parameters }],
          },
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok && body?.messages?.[0]?.id) {
        await updateRow({ status: 'SENT', sent_at: new Date().toISOString(), provider_message_id: body.messages[0].id, error_message: null });
        sent++;
      } else {
        const nextAttempt = (row.attempt_count ?? 0) + 1;
        await updateRow({
          attempt_count: nextAttempt,
          status: nextAttempt >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
          error_message: JSON.stringify(body).slice(0, 1000),
        });
        failed++;
      }
    } catch (err) {
      const nextAttempt = (row.attempt_count ?? 0) + 1;
      await updateRow({
        attempt_count: nextAttempt,
        status: nextAttempt >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
        error_message: String(err).slice(0, 1000),
      });
      failed++;
    }
  }

  return json({ processed: (rows ?? []).length, sent, failed, skipped, deferred });
});
