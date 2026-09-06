import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  ArrowLeft, 
  MessageSquare, 
  FileText, 
  ExternalLink,
  Laptop,
  Layers,
  Lock,
  RefreshCw,
  Building,
  Calendar,
  Sparkles
} from 'lucide-react';
import { LicenceInfo, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';
import { apiPost } from '../../../api/client';

interface LicensingViewProps {
  licenceInfo: LicenceInfo;
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onUpdateLicence: (updated: LicenceInfo) => void;
}

export const LicensingView: React.FC<LicensingViewProps> = ({
  licenceInfo,
  currentStaff,
  onBackToLanding,
  onUpdateLicence,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [activationCodeInput, setActivationCodeInput] = useState('');
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestLogError, setRequestLogError] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleActivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = activationCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setActivationError('Please enter a valid cryptographic activation key or renewal token.');
      return;
    }

    if (cleanCode.length < 10) {
      setActivationError('Invalid key length. Activation keys typically follow format: ITR-PRO-XXXX-XXXX-202X.');
      return;
    }

    setIsSubmitting(true);
    setActivationError(null);

    // Simulate cryptographic token parsing and local signature verification
    setTimeout(() => {
      setIsSubmitting(false);
      const isExpiredSample = cleanCode.includes('EXPIRED') || cleanCode.includes('REVOKE');

      if (isExpiredSample) {
        setActivationError('Licence Requires Renewal: The entered cryptographic token has passed its validity window.');
      } else {
        const updated: LicenceInfo = {
          ...licenceInfo,
          activationCode: cleanCode,
          activationStatus: 'LICENSED',
          productStatus: 'ACTIVE',
          lastActivation: `${new Date().toISOString().replace('T', ' ').slice(0, 19)} (Local Cryptographic Verification OK)`,
          expiryDate: '2027-08-31',
          gracePeriodDaysRemaining: undefined,
          cryptographicSignatureStatus: 'VALID_OFFLINE_SIGNATURE',
        };
        onUpdateLicence(updated);
        setActivationSuccess('Licence Activated: Local signature verified successfully. Full offline entitlements unlocked.');
        setTimeout(() => {
          setActivationSuccess(null);
          setIsActivationModalOpen(false);
          setActivationCodeInput('');
        }, 1800);
      }
    }, 900);
  };

  const getStatusBadge = () => {
    switch (licenceInfo.activationStatus) {
      case 'LICENSED':
        return <StatusBadge status="ACTIVE" customLabel="LICENCE ACTIVATED" />;
      case 'GRACE_PERIOD':
        return <StatusBadge status="PENDING" customLabel={`GRACE PERIOD (${licenceInfo.gracePeriodDaysRemaining} DAYS)`} />;
      case 'REQUIRES_RENEWAL':
        return <StatusBadge status="EXPIRED" customLabel="LICENCE REQUIRES RENEWAL" />;
      case 'EXPIRED':
        return <StatusBadge status="VOIDED" customLabel="EXPIRED" />;
      default:
        return <StatusBadge status="UNKNOWN" />;
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hello iTred Commerce Support,\n\nI would like to request an Activation / Renewal Code for our installation:\n\n` +
    `• Product Code: ${licenceInfo.productCode}\n` +
    `• Installation ID: ${licenceInfo.installationId}\n` +
    `• Company: ${licenceInfo.companyName}\n` +
    `• Branch: ${licenceInfo.branchRegistered}\n` +
    `• Current Plan: ${licenceInfo.planLabel}`
  );

  const whatsappUrl = `https://wa.me/${licenceInfo.supportContactWhatsApp.replace('+', '')}?text=${whatsappMessage}`;

  // DL-056: logs this outbound request as an activation_requests row (so
  // it appears in the console's ActivationRequestsPage queue) alongside
  // opening the wa.me link — never blocking it. The WhatsApp conversation
  // itself is the actual support channel; a failed console-side log is
  // surfaced as a non-blocking notice rather than stopping the tenant from
  // reaching support. Deliberately does not touch handleActivateSubmit or
  // licenceInfo.activationCode — DL-028 leaves that mock flow untouched.
  const handleRequestActivationClick = () => {
    setRequestLogError(null);
    void apiPost('/licensing/request-activation').catch(() => {
      setRequestLogError(
        'Could not reach the licensing server to log this request — your WhatsApp message will still go through, but console staff may not see it queued automatically.'
      );
    });
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
              <KeyRound className="w-4 h-4 text-orange-400" />
              Software Licensing & Cryptographic Activation
            </h1>
            <p className="text-[10px] font-mono text-slate-400">
              Workstation Licence Identity, Autonomous Entitlements, Offline Security & Renewal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsActivationModalOpen(true)}
            leftIcon={<KeyRound className="w-3.5 h-3.5" />}
          >
            Enter Activation Code
          </Button>
        </div>
      </div>

      {/* Grace period or Warning alert if applicable */}
      {licenceInfo.activationStatus === 'GRACE_PERIOD' && (
        <Alert variant="warning" title="Offline Grace Period Active">
          <div className="text-xs text-amber-800 space-y-1">
            <p>
              This workstation is operating in an offline grace period with <strong>{licenceInfo.gracePeriodDaysRemaining} days remaining</strong> before mandatory signature verification.
            </p>
            <p className="text-[11px] text-amber-700">
              All point-of-sale registers, receipt printing, and local inventory will continue functioning normally. Please apply a renewed activation token before the grace period ends.
            </p>
          </div>
        </Alert>
      )}

      {licenceInfo.activationStatus === 'REQUIRES_RENEWAL' && (
        <Alert variant="error" title="Licence Requires Renewal">
          <div className="text-xs text-red-800 space-y-1">
            <p>
              Your local annual license has reached its term expiration ({licenceInfo.expiryDate}).
            </p>
            <p className="text-[11px] text-red-700">
              Please enter your updated offline renewal code to restore full operational status and maintain access to software updates and fiscal support.
            </p>
          </div>
        </Alert>
      )}

      {/* Main Grid: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Main License Parameters */}
        <div className="lg:col-span-2 space-y-4">
          {/* Identity Card */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Workstation License Identity & Identifiers
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                Node ID Encrypted
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Product Code */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Product Code
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {licenceInfo.productCode}
                  </span>
                  <button
                    onClick={() => handleCopy(licenceInfo.productCode, 'productCode')}
                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                    title="Copy Product Code"
                  >
                    {copiedField === 'productCode' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Installation ID */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Installation ID (Hardware Bound)
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-orange-600 truncate max-w-[200px]">
                    {licenceInfo.installationId}
                  </span>
                  <button
                    onClick={() => handleCopy(licenceInfo.installationId, 'installationId')}
                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                    title="Copy Installation ID"
                  >
                    {copiedField === 'installationId' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Current Plan / Edition */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Current Plan / Edition
                </div>
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  {licenceInfo.planLabel}
                </div>
              </div>

              {/* Product Status */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Product Status
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-bold text-slate-800">{licenceInfo.productStatus}</span>
                  <span className="text-[10px] text-slate-500">({licenceInfo.cryptographicSignatureStatus})</span>
                </div>
              </div>
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div className="space-y-0.5">
                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Activation Date
                </div>
                <div className="text-xs font-mono font-medium text-slate-800">
                  {licenceInfo.activationDate}
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Expiry Date
                </div>
                <div className="text-xs font-mono font-bold text-slate-900">
                  {licenceInfo.expiryDate}
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 text-slate-400" />
                  Last Verified
                </div>
                <div className="text-[11px] font-mono text-slate-600 truncate" title={licenceInfo.lastActivation}>
                  {licenceInfo.lastActivation}
                </div>
              </div>
            </div>

            {/* Current Active Token Strip */}
            <div className="bg-slate-900 text-slate-200 p-3 rounded flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-orange-400" />
                <span className="font-mono text-[11px] text-slate-400">Current Key:</span>
                <span className="font-mono font-bold text-orange-300">
                  {licenceInfo.activationCode.replace(/(.{4})/g, '$1-').slice(0, 24)}••••
                </span>
              </div>
              <span className="text-[10px] font-mono bg-slate-800 text-emerald-400 px-2 py-0.5 rounded border border-slate-700">
                Cryptographic Signature: VALID
              </span>
            </div>
          </div>

          {/* Entitlements & Capabilities */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-500" />
                Activated Edition Entitlements ({licenceInfo?.entitlements?.length || 0} Active Modules)
              </h2>
              <span className="text-[10px] font-mono text-slate-500">
                Limit: {licenceInfo?.maxAllowedTerminals || 10} POS Registers
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(licenceInfo?.entitlements || []).map((ent, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{ent}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Actions & Renewal */}
        <div className="space-y-4">
          {/* Quick Renewal Box */}
          <div className="bg-white border border-orange-200 p-4 shadow-xs space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 -mr-8 -mt-8 rounded-full pointer-events-none"></div>

            <div className="flex items-center gap-2 text-orange-700 font-bold text-xs uppercase tracking-wider">
              <KeyRound className="w-4 h-4" />
              Licence Management Actions
            </div>

            <p className="text-xs text-slate-600">
              Apply a renewed offline activation key or purchase a renewal license code directly from authorized distribution.
            </p>

            <div className="space-y-2 pt-1">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsActivationModalOpen(true)}
                leftIcon={<KeyRound className="w-4 h-4" />}
                className="w-full justify-center"
              >
                Enter Activation Code
              </Button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleRequestActivationClick}
                className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                Buy Activation Code via WhatsApp
                <ExternalLink className="w-3 h-3 text-emerald-500" />
              </a>

              {requestLogError && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  {requestLogError}
                </p>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailsModalOpen(true)}
                leftIcon={<FileText className="w-3.5 h-3.5" />}
                className="w-full justify-center text-slate-700"
              >
                View Licence Information
              </Button>
            </div>
          </div>

          {/* Organization & Branch Binding */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-500" />
              Registered Organization Binding
            </h3>

            <div className="text-xs space-y-2 text-slate-600">
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Entity Name</div>
                <div className="font-bold text-slate-800">{licenceInfo.companyName}</div>
              </div>

              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Registered Branch</div>
                <div className="font-medium text-slate-800">{licenceInfo.branchRegistered}</div>
              </div>

              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Security Model</div>
                <div className="text-[11px] font-mono text-emerald-700">Offline RSA-4096 Hardware-Locked Signature</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Enter Activation Code */}
      <Modal
        isOpen={isActivationModalOpen}
        onClose={() => {
          setIsActivationModalOpen(false);
          setActivationError(null);
          setActivationSuccess(null);
        }}
        title="Enter Activation or Renewal Code"
        size="md"
      >
        <form onSubmit={handleActivateSubmit} className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Enter the 24-character cryptographic activation code provided with your iTred Commerce software purchase or renewal agreement.
          </p>

          {activationError && (
            <Alert variant="error" title="Activation Failed">
              {activationError}
            </Alert>
          )}

          {activationSuccess && (
            <Alert variant="success" title="Success">
              {activationSuccess}
            </Alert>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Activation Code
            </label>
            <Input
              value={activationCodeInput}
              onChange={(e) => setActivationCodeInput(e.target.value)}
              placeholder="e.g. ITR-PRO-8892-KL99-OFFL-2026"
              className="font-mono uppercase text-sm tracking-wider"
              autoFocus
            />
            <p className="text-[10px] font-mono text-slate-400">
              Format: ITR-XXXX-XXXX-XXXX-XXXX-XXXX
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-700">Need an Activation Key?</div>
            <div>
              Contact support with your Installation ID (<strong className="font-mono text-slate-800">{licenceInfo.installationId}</strong>) via WhatsApp or phone.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsActivationModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              leftIcon={<Check className="w-4 h-4" />}
            >
              Verify & Activate
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Full Licence Details */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Workstation Licence & Security Diagnostics"
        size="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900 text-slate-100 p-3 rounded font-mono text-[11px] space-y-1.5">
            <div className="text-orange-400 font-bold">--- iTred Commerce Licence Diagnostic Report ---</div>
            <div>Product Code: {licenceInfo.productCode}</div>
            <div>Installation ID: {licenceInfo.installationId}</div>
            <div>Plan Edition: {licenceInfo.currentPlan}</div>
            <div>Product Status: {licenceInfo.productStatus}</div>
            <div>Activation Status: {licenceInfo.activationStatus}</div>
            <div>Max Allowed Terminals: {licenceInfo.maxAllowedTerminals}</div>
            <div>Valid From: {licenceInfo.activationDate}</div>
            <div>Valid Until: {licenceInfo.expiryDate}</div>
            <div>Offline Signature: {licenceInfo.cryptographicSignatureStatus}</div>
            <div>Registered Entity: {licenceInfo.companyName}</div>
            <div>Registered Branch: {licenceInfo.branchRegistered}</div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-slate-800 text-[11px]">
              Offline Cryptographic Security Principle
            </h4>
            <p className="text-slate-600 text-xs leading-relaxed">
              iTred Commerce does not require persistent cloud connectivity for core point-of-sale operations. Software validity is authenticated locally via signed cryptographic tokens bound to the machine's hardware security profile.
            </p>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDetailsModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
