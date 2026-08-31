// WhatsApp template registry (Prompt 10). This is metadata only — the
// Meta-approved template name, its language code, and the ORDER its {{n}}
// positional parameters must be supplied in. It intentionally does NOT
// contain the template body text: Meta owns that once approved, and this
// file must never drift from whatever wording actually gets approved.
//
// See ITRED_GOVERNANCE_AND_ARCHITECTURE.md's "WhatsApp Delivery
// Notifications" addendum for the current DRAFT body text pending sign-off
// and Meta template review — do not treat anything here as final until
// that addendum says so. If a template name or its parameter order changes
// during Meta's review, update it here to match exactly; this registry and
// what's actually configured in Meta Business Manager must always agree.
export interface WhatsAppTemplateDef {
  metaTemplateName: string;
  languageCode: string;
  /** template_params keys, in the exact order the approved template's {{1}}, {{2}}, ... expect them. */
  paramOrder: string[];
}

export const WHATSAPP_TEMPLATES: Record<string, WhatsAppTemplateDef> = {
  delivery_order_assigned: {
    metaTemplateName: 'delivery_order_assigned',
    languageCode: 'en',
    paramOrder: ['customerName', 'pickupBranchName', 'deliveryAddressLine', 'confirmationCode', 'orderRef'],
  },
  delivery_out_for_delivery: {
    metaTemplateName: 'delivery_out_for_delivery',
    languageCode: 'en',
    paramOrder: ['customerName', 'orderRef', 'confirmationCode'],
  },
  delivery_escalation_alert: {
    metaTemplateName: 'delivery_escalation_alert',
    languageCode: 'en',
    paramOrder: ['orderRef', 'orderId', 'reason', 'deliveryAddressLine'],
  },
  delivery_confirmed: {
    metaTemplateName: 'delivery_confirmed',
    languageCode: 'en',
    paramOrder: ['customerName', 'orderRef'],
  },
};
