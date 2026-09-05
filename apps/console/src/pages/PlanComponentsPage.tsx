import React, { useEffect, useState } from 'react';
import { ConsoleShell } from '../components/ConsoleShell';
import { listPlanComponents, createPlanComponent, updatePlanComponent, deletePlanComponent, type PlanComponentRow } from '../lib/consoleApi';

const COMPONENT_TYPES: PlanComponentRow['component_type'][] = ['base', 'branch', 'terminal', 'feature'];

interface DraftState {
  component_type: PlanComponentRow['component_type'];
  feature_key: string;
  unit_price: string;
  currency: string;
  billing_unit: string;
}

const EMPTY_DRAFT: DraftState = { component_type: 'base', feature_key: '', unit_price: '', currency: 'USD', billing_unit: '' };

// DL-043/DL-047: plain price-list CRUD, direct RLS-gated read/write — no
// Edge Function needed, since editing this catalog carries neither a
// signing-key requirement nor a trusted-attribution requirement. billing_unit
// stays free text here deliberately (DL-043's open decision on its exact
// semantics is unresolved) — this page does not validate or interpret it.
export const PlanComponentsPage: React.FC = () => {
  const [components, setComponents] = useState<PlanComponentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setComponents(await listPlanComponents());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(component: PlanComponentRow) {
    setEditingId(component.id);
    setDraft({
      component_type: component.component_type,
      feature_key: component.feature_key ?? '',
      unit_price: String(component.unit_price),
      currency: component.currency,
      billing_unit: component.billing_unit,
    });
  }

  function draftToPayload() {
    return {
      component_type: draft.component_type,
      feature_key: draft.component_type === 'feature' ? draft.feature_key.trim() || null : null,
      unit_price: Number(draft.unit_price),
      currency: draft.currency.trim().toUpperCase(),
      billing_unit: draft.billing_unit.trim(),
    };
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setError(null);
    try {
      await updatePlanComponent(editingId, draftToPayload());
      setEditingId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCreate() {
    setError(null);
    try {
      await createPlanComponent(draftToPayload());
      setCreating(false);
      setDraft(EMPTY_DRAFT);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deletePlanComponent(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function renderForm(onSave: () => void, onCancel: () => void) {
    return (
      <div className="grid grid-cols-5 gap-2 items-center">
        <select
          value={draft.component_type}
          onChange={(e) => setDraft({ ...draft, component_type: e.target.value as PlanComponentRow['component_type'] })}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100"
        >
          {COMPONENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          placeholder="feature_key (feature only)"
          value={draft.feature_key}
          disabled={draft.component_type !== 'feature'}
          onChange={(e) => setDraft({ ...draft, feature_key: e.target.value })}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 disabled:opacity-40"
        />
        <input
          type="number"
          step="0.01"
          placeholder="unit_price"
          value={draft.unit_price}
          onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100"
        />
        <input
          placeholder="currency"
          value={draft.currency}
          onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100"
        />
        <input
          placeholder="billing_unit"
          value={draft.billing_unit}
          onChange={(e) => setDraft({ ...draft, billing_unit: e.target.value })}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100"
        />
        <div className="col-span-5 flex gap-2">
          <button type="button" onClick={onSave} className="text-xs bg-[#FF6B00] text-white px-3 py-1.5 rounded">Save</button>
          <button type="button" onClick={onCancel} className="text-xs text-slate-400 px-3 py-1.5">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <ConsoleShell title="Plan Components" description="The platform-wide billable-item catalog.">
      {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <div className="space-y-2">
          {components.map((component) =>
            editingId === component.id ? (
              <div key={component.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                {renderForm(handleSaveEdit, () => setEditingId(null))}
              </div>
            ) : (
              <div key={component.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-slate-100 font-medium">{component.component_type}</span>
                  {component.feature_key && <span className="text-slate-500"> · {component.feature_key}</span>}
                  <span className="text-slate-500"> · {component.currency} {component.unit_price} / {component.billing_unit}</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEdit(component)} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded">Edit</button>
                  <button type="button" onClick={() => handleDelete(component.id)} className="text-xs bg-slate-800 hover:bg-red-950 text-slate-100 px-3 py-1.5 rounded">Delete</button>
                </div>
              </div>
            )
          )}

          {creating ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              {renderForm(handleCreate, () => { setCreating(false); setDraft(EMPTY_DRAFT); })}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setCreating(true); setDraft(EMPTY_DRAFT); }}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded"
            >
              + Add plan component
            </button>
          )}
        </div>
      )}
    </ConsoleShell>
  );
};
