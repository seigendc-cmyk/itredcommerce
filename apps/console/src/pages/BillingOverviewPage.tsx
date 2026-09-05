import React, { useEffect, useMemo, useState } from 'react';
import { ConsoleShell } from '../components/ConsoleShell';
import { calculateInvoiceLineItems } from '../lib/billingEngine';
import {
  listTenants,
  listPlanComponents,
  listTenantSubscriptions,
  createTenantSubscription,
  updateTenantSubscriptionQuantity,
  deleteTenantSubscription,
  listBillingInvoices,
  generateBillingInvoice,
  markInvoicePaid,
  type TenantRow,
  type PlanComponentRow,
  type TenantSubscriptionRow,
  type BillingInvoiceRow,
} from '../lib/consoleApi';

function currentBillingPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// DL-043/DL-047: this page never decides feature-add-on billing scope or
// proration — it only lets a console operator configure which components a
// tenant is subscribed to (and what quantity), preview the resulting
// invoice via the same neutral calculation the generation Edge Function
// uses, and record payment against an already-generated invoice.
export const BillingOverviewPage: React.FC = () => {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [components, setComponents] = useState<PlanComponentRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [subscriptions, setSubscriptions] = useState<TenantSubscriptionRow[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoiceRow[]>([]);
  const [billingPeriod, setBillingPeriod] = useState(currentBillingPeriod());
  const [addComponentId, setAddComponentId] = useState('');
  const [addQuantity, setAddQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [tenantRows, componentRows] = await Promise.all([listTenants(), listPlanComponents()]);
        setTenants(tenantRows);
        setComponents(componentRows);
        if (tenantRows.length > 0) setSelectedTenantId(tenantRows[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function refreshTenantData(tenantId: string) {
    if (!tenantId) return;
    setError(null);
    try {
      const [subs, invs] = await Promise.all([listTenantSubscriptions(tenantId), listBillingInvoices(tenantId)]);
      setSubscriptions(subs);
      setInvoices(invs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refreshTenantData(selectedTenantId);
  }, [selectedTenantId]);

  const preview = useMemo(() => calculateInvoiceLineItems(components, subscriptions), [components, subscriptions]);
  const componentsById = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);

  async function handleAddSubscription() {
    if (!addComponentId || !selectedTenantId) return;
    setBusy(true);
    setError(null);
    try {
      await createTenantSubscription({ tenantId: selectedTenantId, planComponentId: addComponentId, quantity: addQuantity });
      setAddComponentId('');
      setAddQuantity(1);
      await refreshTenantData(selectedTenantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleQuantityChange(sub: TenantSubscriptionRow, quantity: number) {
    setBusy(true);
    setError(null);
    try {
      await updateTenantSubscriptionQuantity(sub.id, quantity);
      await refreshTenantData(selectedTenantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveSubscription(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteTenantSubscription(id);
      await refreshTenantData(selectedTenantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateInvoice() {
    setBusy(true);
    setError(null);
    try {
      await generateBillingInvoice({ tenantId: selectedTenantId, billingPeriod });
      await refreshTenantData(selectedTenantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid(invoice: BillingInvoiceRow) {
    const reference = window.prompt('Payment reference?') ?? '';
    if (!reference.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await markInvoicePaid(invoice.id, reference.trim());
      await refreshTenantData(selectedTenantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell title="Billing Overview" description="Cross-tenant view of invoices and active plan subscriptions.">
      {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Tenant</label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm text-slate-100 w-full max-w-sm"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.display_name} ({t.status})</option>
              ))}
            </select>
          </div>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Active subscriptions</h2>
            <div className="space-y-2">
              {subscriptions.map((sub) => {
                const component = componentsById.get(sub.plan_component_id);
                // DL-051: feature add-ons bill as one tenant-wide flat fee —
                // a database trigger on tenant_subscriptions rejects any
                // quantity other than 1 for a feature-type component, so the
                // quantity input is locked here rather than letting an
                // operator type a value the server will just reject.
                const isFeature = component?.component_type === 'feature';
                return (
                  <div key={sub.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
                    <div className="text-sm text-slate-100">
                      {component ? `${component.component_type}${component.feature_key ? ` · ${component.feature_key}` : ''}` : sub.plan_component_id}
                      {component && <span className="text-slate-500"> · {component.currency} {component.unit_price} / {component.billing_unit}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={sub.quantity}
                        disabled={busy || isFeature}
                        title={isFeature ? 'Feature add-ons bill as one tenant-wide flat fee (DL-051)' : undefined}
                        onChange={(e) => handleQuantityChange(sub, Number(e.target.value))}
                        className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                      />
                      <button type="button" disabled={busy} onClick={() => handleRemoveSubscription(sub.id)} className="text-xs bg-slate-800 hover:bg-red-950 text-slate-100 px-2 py-1 rounded">Remove</button>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <select
                  value={addComponentId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setAddComponentId(nextId);
                    // DL-051: selecting a feature add-on locks quantity to 1
                    // immediately, matching the tenant_subscriptions trigger
                    // that would otherwise reject anything else on submit.
                    if (componentsById.get(nextId)?.component_type === 'feature') setAddQuantity(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 flex-1"
                >
                  <option value="">Add a component...</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>{c.component_type}{c.feature_key ? ` · ${c.feature_key}` : ''} ({c.currency} {c.unit_price}/{c.billing_unit})</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={addQuantity}
                  disabled={componentsById.get(addComponentId)?.component_type === 'feature'}
                  title={componentsById.get(addComponentId)?.component_type === 'feature' ? 'Feature add-ons bill as one tenant-wide flat fee (DL-051)' : undefined}
                  onChange={(e) => setAddQuantity(Number(e.target.value))}
                  className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                />
                <button type="button" disabled={!addComponentId || busy} onClick={handleAddSubscription} className="text-xs bg-[#FF6B00] text-white px-3 py-1.5 rounded disabled:opacity-50">Add</button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Invoice preview</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              {preview.lineItems.length === 0 ? (
                <p className="text-sm text-slate-500">No active subscriptions to bill.</p>
              ) : (
                <>
                  {preview.lineItems.map((li, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-800 last:border-0">
                      <span className="text-slate-300">{li.componentType}{li.featureKey ? ` · ${li.featureKey}` : ''} × {li.quantity} ({li.billingUnit})</span>
                      <span className="text-slate-100">{li.currency} {li.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm pt-2 font-semibold">
                    <span className="text-slate-100">Total</span>
                    <span className="text-slate-100">{preview.currency} {preview.total.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                <input
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  placeholder="YYYY-MM"
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100"
                />
                <button
                  type="button"
                  disabled={busy || preview.lineItems.length === 0}
                  onClick={handleGenerateInvoice}
                  className="text-xs bg-[#FF6B00] text-white px-3 py-1.5 rounded disabled:opacity-50"
                >
                  Generate invoice
                </button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Invoices</h2>
            <div className="space-y-2">
              {invoices.length === 0 && <p className="text-sm text-slate-500">No invoices yet.</p>}
              {invoices.map((inv) => (
                <div key={inv.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-slate-100 font-medium">{inv.billing_period}</span>
                    <span className="text-slate-500"> · {inv.currency} {inv.total.toFixed(2)}</span>
                    {inv.payment_reference && <span className="text-slate-500"> · ref {inv.payment_reference}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${inv.status === 'paid' ? 'bg-emerald-950/60 text-emerald-300' : inv.status === 'overdue' ? 'bg-red-950/60 text-red-300' : 'bg-amber-950/60 text-amber-300'}`}>
                      {inv.status}
                    </span>
                    {inv.status !== 'paid' && (
                      <button type="button" disabled={busy} onClick={() => handleMarkPaid(inv)} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 px-2 py-1 rounded">
                        Mark paid
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </ConsoleShell>
  );
};
