import React, { useEffect, useState } from 'react';
import { ConsoleShell } from '../components/ConsoleShell';
import {
  listActivationRequests,
  issueTerminalActivationToken,
  resolveActivationRequest,
  type ActivationRequestRow,
} from '../lib/consoleApi';

// DL-041/DL-046: the console-side half of the WhatsApp "Request
// TerminalActivationToken" flow. Issuance itself (signing, writing
// terminal_activation_tokens) happens in the console-issue-terminal-
// activation-token Edge Function, which also needs the signing key this
// client never has access to.
export const ActivationRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<ActivationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuingFor, setIssuingFor] = useState<string | null>(null);
  const [terminalId, setTerminalId] = useState('');
  const [planTier, setPlanTier] = useState('PROFESSIONAL');
  const [validityDays, setValidityDays] = useState(30);
  const [issuedToken, setIssuedToken] = useState<{ requestId: string; token: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setRequests(await listActivationRequests());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleIssue(request: ActivationRequestRow) {
    if (!terminalId.trim()) {
      setError('Terminal ID is required to issue a token');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await issueTerminalActivationToken({
        tenantId: request.tenant_id,
        terminalId: terminalId.trim(),
        planTier,
        validityDays,
        activationRequestId: request.id,
      });
      setIssuedToken({ requestId: request.id, token: result.token, expiresAt: result.expiresAt });
      setIssuingFor(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(request: ActivationRequestRow) {
    setBusy(true);
    setError(null);
    try {
      await resolveActivationRequest({ activationRequestId: request.id, fulfillmentStatus: 'rejected' });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell
      title="Activation Requests"
      description="Incoming TerminalActivationToken requests, queued for manual fulfillment."
    >
      {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2 mb-4">{error}</p>}

      {issuedToken && (
        <div className="mb-4 bg-emerald-950/40 border border-emerald-900 rounded px-3 py-3 text-sm">
          <p className="text-emerald-300 font-semibold mb-1">Token issued — relay this to the tenant via WhatsApp now. It will not be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200">{issuedToken.token}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(issuedToken.token)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 px-2 py-1 rounded shrink-0"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-emerald-400/70 mt-1">Expires {new Date(issuedToken.expiresAt).toLocaleString()}</p>
          <button type="button" onClick={() => setIssuedToken(null)} className="text-xs text-slate-400 mt-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-500">No activation requests.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => (
            <div key={request.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{request.tenant_id}</p>
                  <p className="text-xs text-slate-500">
                    Requested {new Date(request.requested_at).toLocaleString()} via {request.channel}
                    {request.terminal_id ? ` · terminal ${request.terminal_id}` : ''}
                  </p>
                  {request.fulfilled_by && (
                    <p className="text-xs text-slate-500">
                      {request.fulfillment_status} by {request.fulfilled_by} at {request.fulfilled_at ? new Date(request.fulfilled_at).toLocaleString() : ''}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                    request.fulfillment_status === 'pending'
                      ? 'bg-amber-950/60 text-amber-300'
                      : request.fulfillment_status === 'fulfilled'
                      ? 'bg-emerald-950/60 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {request.fulfillment_status}
                </span>
              </div>

              {request.fulfillment_status === 'pending' && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  {issuingFor === request.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          placeholder="Terminal ID"
                          value={terminalId}
                          onChange={(e) => setTerminalId(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100"
                        />
                        <input
                          placeholder="Plan tier"
                          value={planTier}
                          onChange={(e) => setPlanTier(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100"
                        />
                        <input
                          type="number"
                          min={1}
                          placeholder="Validity (days)"
                          value={validityDays}
                          onChange={(e) => setValidityDays(Number(e.target.value))}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleIssue(request)}
                          className="text-xs bg-[#FF6B00] text-white px-3 py-1.5 rounded disabled:opacity-50"
                        >
                          Issue token
                        </button>
                        <button type="button" onClick={() => setIssuingFor(null)} className="text-xs text-slate-400 px-3 py-1.5">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIssuingFor(request.id);
                          setTerminalId(request.terminal_id ?? '');
                        }}
                        className="text-xs bg-[#FF6B00] text-white px-3 py-1.5 rounded"
                      >
                        Issue token
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleReject(request)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ConsoleShell>
  );
};
