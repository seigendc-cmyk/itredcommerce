import React, { useEffect, useState } from 'react';
import { ArrowLeft, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';
import { LoadingState } from '../../ui/LoadingState';
import { apiGet, apiPatch, ApiClientError } from '../../../api/client';

interface BIConfigViewProps {
  currentStaff: StaffMember;
  onBackToLanding: () => void;
}

type ParameterType = 'number' | 'boolean' | 'string';

interface BiRuleParameterDef {
  name: string;
  type: ParameterType;
  default: number | boolean | string;
  min?: number;
  max?: number;
}

interface BiRuleRow {
  ruleId: string;
  version: number;
  category: string;
  description: string;
  parameters: BiRuleParameterDef[];
  enabled: boolean;
  parameterValues: Record<string, unknown>;
  orphanedParameters: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  CAPITAL_VELOCITY: 'Capital Velocity',
  BUDGET_VARIANCE_ADVISOR: 'Budget Variance Advisor',
  FORENSIC_THEFT_GUARD: 'Forensic Theft Guard',
  DEAD_STOCK_SEASONAL_DISPOSAL: 'Dead Stock / Seasonal Disposal',
};

function groupByCategory(rules: BiRuleRow[]): Array<[string, BiRuleRow[]]> {
  const groups = new Map<string, BiRuleRow[]>();
  for (const rule of rules) {
    if (!groups.has(rule.category)) groups.set(rule.category, []);
    groups.get(rule.category)!.push(rule);
  }
  return Array.from(groups.entries());
}

// DL-059's Config page: platform-authored rule LOGIC is never editable here
// — only the enable/disable toggle and each rule's declared tunable
// parameters, bounded to the platform's own min/max/type. Head-office-only,
// gated the same way the ActiveView isn't in BRANCH_TERMINAL_VIEWS
// (src/utils/accessRoleGate.ts).
export const BIConfigView: React.FC<BIConfigViewProps> = ({ onBackToLanding }) => {
  const [rules, setRules] = useState<BiRuleRow[]>([]);
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiGet<BiRuleRow[]>('/bi-rules');
      setRules(data);
      setEdits(Object.fromEntries(data.map((r) => [r.ruleId, { ...r.parameterValues }])));
    } catch (e) {
      setLoadError(e instanceof ApiClientError ? e.message : 'Failed to load BI rules');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function setEdit(ruleId: string, paramName: string, value: unknown) {
    setEdits((prev) => ({ ...prev, [ruleId]: { ...prev[ruleId], [paramName]: value } }));
  }

  function resetToDefault(rule: BiRuleRow, param: BiRuleParameterDef) {
    setEdit(rule.ruleId, param.name, param.default);
  }

  async function toggleEnabled(rule: BiRuleRow) {
    setSavingRuleId(rule.ruleId);
    setSaveError(null);
    try {
      await apiPatch(`/bi-rules/${rule.ruleId}/settings`, { enabled: !rule.enabled });
      await refresh();
    } catch (e) {
      setSaveError(e instanceof ApiClientError ? e.message : 'Failed to update rule');
    } finally {
      setSavingRuleId(null);
    }
  }

  async function saveParameters(rule: BiRuleRow) {
    setSavingRuleId(rule.ruleId);
    setSaveError(null);
    try {
      await apiPatch(`/bi-rules/${rule.ruleId}/settings`, { parameterValues: edits[rule.ruleId] ?? {} });
      await refresh();
    } catch (e) {
      setSaveError(e instanceof ApiClientError ? e.message : 'Failed to save parameters');
    } finally {
      setSavingRuleId(null);
    }
  }

  async function acknowledgeOrphaned(rule: BiRuleRow) {
    setSavingRuleId(rule.ruleId);
    setSaveError(null);
    try {
      await apiPatch(`/bi-rules/${rule.ruleId}/settings`, { acknowledgeOrphanedParameters: true });
      await refresh();
    } catch (e) {
      setSaveError(e instanceof ApiClientError ? e.message : 'Failed to acknowledge');
    } finally {
      setSavingRuleId(null);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 space-y-4">
      <div className="bg-slate-900 text-white p-3.5 border border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToLanding}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            Landing
          </Button>
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <ShieldCheck className="w-4 h-4" />
            BI Brain — Rule Configuration
          </div>
        </div>
      </div>

      {loadError && <Alert type="error">{loadError}</Alert>}
      {saveError && <Alert type="error" onClose={() => setSaveError(null)}>{saveError}</Alert>}

      {loading ? (
        <LoadingState label="Loading BI rules..." />
      ) : rules.length === 0 ? (
        <Alert type="info">No BI Brain rules are configured on this platform yet.</Alert>
      ) : (
        groupByCategory(rules).map(([category, categoryRules]) => (
          <div key={category} className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 pt-2">
              {CATEGORY_LABELS[category] ?? category}
            </h3>
            {categoryRules.map((rule) => (
              <div key={rule.ruleId} className="bg-white border border-slate-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{rule.description}</p>
                    <p className="text-xs text-slate-500">{rule.ruleId} · v{rule.version}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase text-slate-600 shrink-0">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      disabled={savingRuleId === rule.ruleId}
                      onChange={() => toggleEnabled(rule)}
                    />
                    Enabled
                  </label>
                </div>

                {rule.orphanedParameters.length > 0 && (
                  <Alert
                    type="warning"
                    action={
                      <Button size="sm" variant="outline" onClick={() => acknowledgeOrphaned(rule)} disabled={savingRuleId === rule.ruleId}>
                        Acknowledge
                      </Button>
                    }
                  >
                    A newer version of this rule dropped: {rule.orphanedParameters.join(', ')}. Your prior values are
                    kept but no longer used.
                  </Alert>
                )}

                {rule.parameters.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rule.parameters.map((param) => {
                      const currentValue = edits[rule.ruleId]?.[param.name] ?? rule.parameterValues[param.name];
                      return (
                        <div key={param.name} className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                            <span>
                              {param.name}
                              {param.type === 'number' && param.min !== undefined && param.max !== undefined && (
                                <span className="text-slate-400 font-normal"> ({param.min}–{param.max})</span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => resetToDefault(rule, param)}
                              className="text-slate-400 hover:text-slate-700"
                              title={`Reset to platform default (${String(param.default)})`}
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </label>
                          {param.type === 'boolean' ? (
                            <input
                              type="checkbox"
                              checked={!!currentValue}
                              onChange={(e) => setEdit(rule.ruleId, param.name, e.target.checked)}
                            />
                          ) : (
                            <input
                              type={param.type === 'number' ? 'number' : 'text'}
                              value={String(currentValue ?? '')}
                              min={param.min}
                              max={param.max}
                              onChange={(e) =>
                                setEdit(rule.ruleId, param.name, param.type === 'number' ? Number(e.target.value) : e.target.value)
                              }
                              className="w-full bg-white border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          )}
                          <p className="text-[11px] text-slate-400">Platform default: {String(param.default)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {rule.parameters.length > 0 && (
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                    disabled={savingRuleId === rule.ruleId}
                    onClick={() => saveParameters(rule)}
                  >
                    Save parameters
                  </Button>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};
