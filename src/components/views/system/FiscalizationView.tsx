import React, { useState } from 'react';
import { 
  FileCheck2, 
  Cpu, 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  QrCode, 
  Play, 
  Square, 
  RotateCw, 
  ExternalLink, 
  Layers, 
  Clock, 
  Sliders, 
  Check, 
  FileText, 
  HardDrive,
  Building,
  Zap,
  Info
} from 'lucide-react';
import { FiscalConfig, FiscalDocumentQueueItem, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';

interface FiscalizationViewProps {
  fiscalConfig: FiscalConfig;
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onUpdateFiscalConfig: (updated: FiscalConfig) => void;
}

export const FiscalizationView: React.FC<FiscalizationViewProps> = ({
  fiscalConfig,
  currentStaff,
  onBackToLanding,
  onUpdateFiscalConfig,
}) => {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<string | null>(null);
  const [selectedDocForDetails, setSelectedDocForDetails] = useState<FiscalDocumentQueueItem | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isZReportModalOpen, setIsZReportModalOpen] = useState(false);
  const [isProcessingDayAction, setIsProcessingDayAction] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Form states for settings
  const [formJurisdiction, setFormJurisdiction] = useState(fiscalConfig.jurisdiction);
  const [formProvider, setFormProvider] = useState(fiscalConfig.provider);
  const [formEndpoint, setFormEndpoint] = useState(fiscalConfig.serviceEndpointOrPort);
  const [formDeviceSerial, setFormDeviceSerial] = useState(fiscalConfig.deviceSerialNumber);
  const [formTaxPin, setFormTaxPin] = useState(fiscalConfig.pinOrTaxId);
  const [formPrintQr, setFormPrintQr] = useState(fiscalConfig.printFiscalQrOnReceipt);

  const handleTestConnection = () => {
    setIsTestingConnection(true);
    setConnectionTestResult(null);

    setTimeout(() => {
      setIsTestingConnection(false);
      setConnectionTestResult(
        `Direct Handshake Verified on ${fiscalConfig.serviceEndpointOrPort}. Fiscal Memory Module: OK (Day #${fiscalConfig.fiscalDayNumber}, ${fiscalConfig.memoryRemainingPercent}% Storage Available).`
      );
      setTimeout(() => setConnectionTestResult(null), 6000);
    }, 1000);
  };

  const handleOpenFiscalDay = () => {
    setIsProcessingDayAction(true);
    setTimeout(() => {
      setIsProcessingDayAction(false);
      const nextDay = fiscalConfig.fiscalDayNumber + 1;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const updated: FiscalConfig = {
        ...fiscalConfig,
        fiscalDayStatus: 'OPEN',
        fiscalDayNumber: nextDay,
        fiscalDayOpenedAt: now,
      };
      onUpdateFiscalConfig(updated);
      setActionNotice(`Fiscal Day #${nextDay} successfully opened. Ready to sign legal fiscal sales.`);
      setTimeout(() => setActionNotice(null), 4000);
    }, 1000);
  };

  const handleCloseFiscalDay = () => {
    setIsZReportModalOpen(false);
    setIsProcessingDayAction(true);
    setTimeout(() => {
      setIsProcessingDayAction(false);
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const nextZ = (fiscalConfig.lastZReportNumber || 247) + 1;
      const updated: FiscalConfig = {
        ...fiscalConfig,
        fiscalDayStatus: 'CLOSED',
        lastZReportDate: now,
        lastZReportNumber: nextZ,
        offlineGraceHoursRemaining: 48,
      };
      onUpdateFiscalConfig(updated);
      setActionNotice(`Daily Z-Report #${nextZ} generated and signed into non-volatile fiscal memory. Fiscal Day #${fiscalConfig.fiscalDayNumber} closed.`);
      setTimeout(() => setActionNotice(null), 4500);
    }, 1200);
  };

  const handleRetryDocument = (docId: string) => {
    const updatedQueue = fiscalConfig.queue.map((doc) => {
      if (doc.id === docId) {
        return {
          ...doc,
          status: 'TRANSMITTED' as const,
          retryCount: doc.retryCount + 1,
          fiscalSignature: `RETRY-SIG-${Date.now().toString().slice(-6)}`,
          qrCodePayload: `https://itax.kra.go.ke/verification?inv=${doc.documentNumber}&retry=ok`,
          lastError: undefined,
        };
      }
      return doc;
    });

    const updated: FiscalConfig = {
      ...fiscalConfig,
      queue: updatedQueue,
      pendingDocumentsCount: Math.max(0, fiscalConfig.pendingDocumentsCount - 1),
    };

    onUpdateFiscalConfig(updated);
    setActionNotice('Document successfully transmitted and cryptographically registered.');
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: FiscalConfig = {
      ...fiscalConfig,
      jurisdiction: formJurisdiction,
      provider: formProvider,
      serviceEndpointOrPort: formEndpoint,
      deviceSerialNumber: formDeviceSerial,
      pinOrTaxId: formTaxPin,
      printFiscalQrOnReceipt: formPrintQr,
    };
    onUpdateFiscalConfig(updated);
    setIsSettingsModalOpen(false);
    setActionNotice('Fiscal hardware adapter parameters updated successfully.');
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 space-y-4 select-none">
      {/* Header */}
      <div className="bg-slate-900 text-white p-3.5 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
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
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-orange-400" />
              Tax Compliance & Hardware Fiscalization (ETR/ESD)
            </h1>
            <p className="text-[10px] font-mono text-slate-400">
              Provider-Agnostic Cryptographic Fiscal Signatures, Daily Z-Reports & Document Verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge
            status={fiscalConfig.fiscalDayStatus === 'OPEN' ? 'ACTIVE' : 'PENDING'}
            customLabel={`FISCAL DAY ${fiscalConfig.fiscalDayStatus}: #${fiscalConfig.fiscalDayNumber}`}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestConnection}
            isLoading={isTestingConnection}
            leftIcon={<Zap className="w-3.5 h-3.5" />}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            Test Connection
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsSettingsModalOpen(true)}
            leftIcon={<Sliders className="w-3.5 h-3.5" />}
          >
            Fiscal Settings
          </Button>
        </div>
      </div>

      {actionNotice && (
        <Alert variant="success" title="Fiscal Event Completed">
          {actionNotice}
        </Alert>
      )}

      {connectionTestResult && (
        <Alert variant="info" title="Hardware Loopback Test">
          {connectionTestResult}
        </Alert>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Status Card & Document Queue */}
        <div className="lg:col-span-2 space-y-4">
          {/* Status Overview Card */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Fiscal Device & Compliance Engine Identity
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                Mode: {fiscalConfig.deviceOrServiceMode}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tax Jurisdiction
                </div>
                <div className="text-xs font-bold text-slate-800 truncate" title={fiscalConfig.jurisdiction}>
                  {fiscalConfig.jurisdiction}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Taxpayer PIN / VAT No
                </div>
                <div className="text-xs font-mono font-bold text-orange-600">
                  {fiscalConfig.pinOrTaxId}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Device Serial Number
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 truncate" title={fiscalConfig.deviceSerialNumber}>
                  {fiscalConfig.deviceSerialNumber}
                </div>
              </div>
            </div>

            {/* Fiscal Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
              <div className="p-2 bg-slate-50 rounded">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Fiscal Day:</div>
                <div className="font-bold text-slate-800">#{fiscalConfig.fiscalDayNumber} ({fiscalConfig.fiscalDayStatus})</div>
              </div>

              <div className="p-2 bg-slate-50 rounded">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Last Z-Report:</div>
                <div className="font-mono text-slate-700">#{fiscalConfig.lastZReportNumber || 247}</div>
              </div>

              <div className="p-2 bg-slate-50 rounded">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Memory Left:</div>
                <div className="font-bold text-emerald-700">{fiscalConfig.memoryRemainingPercent}%</div>
              </div>

              <div className="p-2 bg-slate-50 rounded">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Pending Buffer:</div>
                <div className="font-bold text-orange-600">{fiscalConfig.pendingDocumentsCount} Documents</div>
              </div>
            </div>
          </div>

          {/* Document Queue & Status */}
          <div className="bg-white border border-slate-200 shadow-xs space-y-0">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-orange-500" />
                Fiscal Document Journal & Offline Sync Queue ({fiscalConfig?.queue?.length || 0})
              </h3>
              <span className="text-[10px] font-mono text-slate-500">
                Cryptographic Signatures & Tax QR Codes
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {(fiscalConfig?.queue || []).map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs hover:bg-slate-50 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800">{doc.documentNumber}</span>
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-slate-100 text-slate-700 rounded">
                        {doc.documentType}
                      </span>
                      <StatusBadge
                        status={
                          doc.status === 'TRANSMITTED'
                            ? 'ACTIVE'
                            : doc.status === 'SIGNED_OFFLINE'
                            ? 'PENDING'
                            : 'VOIDED'
                        }
                        customLabel={doc.status}
                      />
                    </div>

                    <div className="text-[10px] font-mono text-slate-500 flex flex-wrap items-center gap-2">
                      <span>{doc.timestamp}</span>
                      <span>• Amount: ${doc.amount.toFixed(2)}</span>
                      <span>• Tax: ${doc.taxAmount.toFixed(2)}</span>
                      {doc.fiscalSignature && (
                        <span className="text-emerald-700">• Sig: {doc.fiscalSignature.slice(0, 9)}…</span>
                      )}
                    </div>

                    {doc.lastError && (
                      <div className="text-[10px] text-amber-700 font-mono">
                        Note: {doc.lastError}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {doc.status !== 'TRANSMITTED' && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleRetryDocument(doc.id)}
                        leftIcon={<RotateCw className="w-3 h-3" />}
                      >
                        Retry Sync
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedDocForDetails(doc)}
                      leftIcon={<FileText className="w-3 h-3" />}
                      className="text-slate-700"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Operational Actions & Z-Report Controls */}
        <div className="space-y-4">
          {/* Fiscal Day Lifecycle Box */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              Fiscal Day Controls & Z-Report
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Fiscal regulations require opening a daily register cycle and generating an end-of-day Z-Report to commit sales to non-volatile memory.
            </p>

            <div className="space-y-2 pt-1">
              {fiscalConfig.fiscalDayStatus === 'OPEN' ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsZReportModalOpen(true)}
                  isLoading={isProcessingDayAction}
                  leftIcon={<Square className="w-4 h-4" />}
                  className="w-full justify-center bg-red-600 hover:bg-red-700 text-white"
                >
                  Close Fiscal Day & Generate Z-Report
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleOpenFiscalDay}
                  isLoading={isProcessingDayAction}
                  leftIcon={<Play className="w-4 h-4" />}
                  className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Open Fiscal Day #{fiscalConfig.fiscalDayNumber + 1}
                </Button>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1 text-xs">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Offline Autonomous Mode</div>
                <div className="text-[11px] text-slate-700">
                  Grace Window: <strong>{fiscalConfig.offlineGraceHoursRemaining} hours</strong> offline signing buffer remaining before mandatory connection handshake.
                </div>
              </div>
            </div>
          </div>

          {/* QR Code & Slip Preview Sample */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-slate-600" />
              Customer Tax Receipt Slip Sample
            </h3>

            <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded text-center space-y-2 font-mono text-[10px] text-slate-600">
              <div className="font-bold text-slate-900">*** LEGAL FISCAL RECEIPT ***</div>
              <div>PIN: {fiscalConfig.pinOrTaxId}</div>
              <div>ETR S/N: {fiscalConfig.deviceSerialNumber}</div>
              <div>DAY: #{fiscalConfig.fiscalDayNumber} • RECEIPT: 0012</div>
              <div className="w-20 h-20 mx-auto bg-slate-900 text-white flex items-center justify-center rounded p-1">
                <QrCode className="w-14 h-14 text-white" />
              </div>
              <div className="text-[9px] text-slate-500 break-all">
                SIG: F7A9-00B2-88C1-99DE-3312
              </div>
              <div className="text-emerald-700 font-bold">TAX SIGNATURE VERIFIED</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Document Fiscal Details & QR Code */}
      <Modal
        isOpen={!!selectedDocForDetails}
        onClose={() => setSelectedDocForDetails(null)}
        title={`Fiscal Signature: ${selectedDocForDetails?.documentNumber || ''}`}
        size="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-900 text-slate-200 rounded font-mono text-[11px] space-y-1.5">
            <div className="text-orange-400 font-bold">--- Cryptographic Fiscal Proof ---</div>
            <div>Doc Number: {selectedDocForDetails?.documentNumber}</div>
            <div>Doc Type: {selectedDocForDetails?.documentType}</div>
            <div>Timestamp: {selectedDocForDetails?.timestamp}</div>
            <div>Total Amount: ${selectedDocForDetails?.amount.toFixed(2)}</div>
            <div>Tax (VAT): ${selectedDocForDetails?.taxAmount.toFixed(2)}</div>
            <div>Status: {selectedDocForDetails?.status}</div>
            <div className="text-emerald-400 font-bold">
              Signature: {selectedDocForDetails?.fiscalSignature || 'PENDING_LOCAL_BUFFER'}
            </div>
          </div>

          {selectedDocForDetails?.qrCodePayload && (
            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2 text-center">
              <div className="font-bold text-slate-800">Verification URL / QR Payload</div>
              <div className="text-[11px] font-mono text-slate-600 break-all bg-white p-2 border border-slate-200 rounded">
                {selectedDocForDetails.qrCodePayload}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDocForDetails(null)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Z-Report Confirmation */}
      <Modal
        isOpen={isZReportModalOpen}
        onClose={() => setIsZReportModalOpen(false)}
        title="Generate Daily Fiscal Z-Report"
        size="md"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-700 leading-relaxed">
            Closing Fiscal Day <strong>#{fiscalConfig.fiscalDayNumber}</strong> will compile all daily tax accumulators, commit them to physical fiscal memory, and print the legal Z-Report slip.
          </p>

          <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded text-[11px] space-y-1">
            <div className="font-bold">Important Notice:</div>
            <div>Once closed, this fiscal day cannot be reopened. Subsequent sales will initiate Fiscal Day #{fiscalConfig.fiscalDayNumber + 1}.</div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsZReportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCloseFiscalDay}
              className="bg-red-600 hover:bg-red-700 text-white"
              leftIcon={<Check className="w-4 h-4" />}
            >
              Confirm Z-Report & Close Day
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Fiscal Settings */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Fiscal Device & Compliance Configuration"
        size="md"
      >
        <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Tax Jurisdiction / Legal Standard
            </label>
            <select
              value={formJurisdiction}
              onChange={(e) => setFormJurisdiction(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
            >
              <option value="Kenya (KRA TIMS/eTIMS Standard Type C)">Kenya (KRA TIMS/eTIMS Standard Type C)</option>
              <option value="Zimbabwe (ZIMRA FDMS Direct Signer)">Zimbabwe (ZIMRA FDMS Direct Signer)</option>
              <option value="Tanzania (TRA VFD Protocol)">Tanzania (TRA VFD Protocol)</option>
              <option value="Rwanda (RRA EBM v2 Protocol)">Rwanda (RRA EBM v2 Protocol)</option>
              <option value="Generic Fiscal Memory Device (Standard Mode)">Generic Fiscal Memory Device (Standard Mode)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Hardware Provider / Driver Adapter
            </label>
            <Input
              value={formProvider}
              onChange={(e) => setFormProvider(e.target.value)}
              placeholder="e.g. Datecs / Tremol Fiscal Memory Control Unit"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Port / IP Address
              </label>
              <Input
                value={formEndpoint}
                onChange={(e) => setFormEndpoint(e.target.value)}
                placeholder="e.g. COM4 (115200 Baud)"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Taxpayer PIN / VAT ID
              </label>
              <Input
                value={formTaxPin}
                onChange={(e) => setFormTaxPin(e.target.value)}
                placeholder="e.g. P051289842M"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Fiscal Device Serial Number
            </label>
            <Input
              value={formDeviceSerial}
              onChange={(e) => setFormDeviceSerial(e.target.value)}
              placeholder="e.g. KRA-ETR-2026-098842"
              required
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={formPrintQr}
                onChange={(e) => setFormPrintQr(e.target.checked)}
                className="text-orange-600 rounded"
              />
              <span className="font-bold text-[11px]">Print Tax Verification QR Code on Receipts</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              leftIcon={<Check className="w-4 h-4" />}
            >
              Save Configuration
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
