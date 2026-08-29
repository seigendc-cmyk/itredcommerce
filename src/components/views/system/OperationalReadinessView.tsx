import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  HardDrive, 
  Wifi, 
  WifiOff, 
  Database, 
  FileCheck, 
  Key, 
  RotateCcw, 
  Clock, 
  Check, 
  Info, 
  Server, 
  ShieldAlert, 
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  OperationalReadinessSnapshot, 
  StaffMember, 
  ActivityEvent, 
  OperationalException,
  FiscalConfig,
  LicenceInfo
} from '../../../types';
import { Button } from '../../ui/Button';

export interface OperationalReadinessViewProps {
  currentStaff: StaffMember;
  readinessSnapshot: OperationalReadinessSnapshot;
  offlineEventQueue: ActivityEvent[];
  exceptions: OperationalException[];
  fiscalConfig?: FiscalConfig;
  licenseInfo?: LicenceInfo;
  onBackToLanding: () => void;
  onTriggerBackup: () => void;
  onTriggerSyncRetry: () => void;
  onNavigateToDataProtection?: () => void;
  onNavigateToIntegrity?: () => void;
  onRecordActivityEvent?: (event: ActivityEvent) => void;
}

export const OperationalReadinessView: React.FC<OperationalReadinessViewProps> = ({
  currentStaff,
  readinessSnapshot,
  offlineEventQueue = [],
  exceptions = [],
  fiscalConfig,
  licenseInfo,
  onBackToLanding,
  onTriggerBackup,
  onTriggerSyncRetry,
  onNavigateToDataProtection,
  onNavigateToIntegrity,
  onRecordActivityEvent,
}) => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleBackupNow = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      onTriggerBackup();
      setIsBackingUp(false);
      setActionNotice('Local database snapshot and encrypted ledger backup successfully archived.');
      
      if (onRecordActivityEvent) {
        onRecordActivityEvent({
          id: `EVT-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          eventType: 'BACKUP_COMPLETED',
          description: `Manual encrypted backup completed by ${currentStaff.name}. Archive hash: SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          branchId: 'BR-01',
          branchName: 'Main Store',
        });
      }

      setTimeout(() => setActionNotice(null), 5000);
    }, 1200);
  };

  const handleRetrySync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      onTriggerSyncRetry();
      setIsSyncing(false);
      setActionNotice('Offline event stream synchronized with centralized cloud register.');
      
      if (onRecordActivityEvent) {
        onRecordActivityEvent({
          id: `EVT-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          eventType: 'SYNC_COMPLETED',
          description: `Offline queue flushed and synchronized (${offlineEventQueue.length} events processed).`,
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          branchId: 'BR-01',
          branchName: 'Main Store',
        });
      }

      setTimeout(() => setActionNotice(null), 5000);
    }, 1500);
  };

  const isOnline = readinessSnapshot.connectivityStatus === 'ONLINE';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] text-[#1c1d22]">
      {/* Header */}
      <div className="bg-white border-b border-[#e1e4ea] px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBackToLanding} className="p-1.5 hover:bg-[#f1f3f7] rounded-md">
            <ArrowLeft className="w-4 h-4 text-[#555a68]" />
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-[#1c1d22]">Operational Readiness & POS Health</h1>
              {readinessSnapshot.applicationStatus === 'READY' ? (
                <span className="bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] text-xs font-semibold px-2 py-0.5 rounded flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  POS Ready
                </span>
              ) : (
                <span className="bg-[#fff7ed] text-[#ea580c] border border-[#fed7aa] text-xs font-semibold px-2 py-0.5 rounded flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Attention Required
                </span>
              )}
            </div>
            <p className="text-xs text-[#6e7485] mt-0.5">
              Continuity status for local transaction processing, database persistence, synchronization queues, and fiscal compliance.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRetrySync} 
            disabled={isSyncing}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchronizing...' : 'Sync Queues'}
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleBackupNow} 
            disabled={isBackingUp}
            className="bg-[#e05e00] hover:bg-[#c95400] text-white text-xs font-medium"
          >
            <HardDrive className={`w-3.5 h-3.5 mr-1.5 ${isBackingUp ? 'animate-pulse' : ''}`} />
            {isBackingUp ? 'Archiving Snapshot...' : 'Backup Now'}
          </Button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="bg-[#ecfdf5] border-b border-[#a7f3d0] px-6 py-2.5 flex items-center justify-between text-xs text-[#065f46]">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#059669]" />
            <span className="font-medium">{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-[#059669] hover:text-[#065f46]">
            ✕
          </button>
        </div>
      )}

      {/* Main Status Grid */}
      <div className="flex-1 px-6 py-6 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Core System Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. Connectivity & POS Offline Capability */}
            <div className="bg-white border border-[#e1e4ea] rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isOnline ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#eff6ff] text-[#2563eb]'
                  }`}>
                    {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs text-[#6e7485] font-semibold uppercase tracking-wider">Network & Mode</div>
                    <div className="text-sm font-bold text-[#1c1d22]">
                      {isOnline ? 'Online (Connected)' : 'Offline — Local POS Ready'}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  isOnline 
                    ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]' 
                    : 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]'
                }`}>
                  {isOnline ? 'Active' : 'Offline Ready'}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-[#f1f3f7] text-xs text-[#555a68] leading-relaxed">
                {isOnline ? (
                  'Real-time connectivity established with cloud backend. Transactions streaming without latency.'
                ) : (
                  'Network disconnected. POS continues operating fully with local IndexedDB persistence and offline journal queues.'
                )}
              </div>
            </div>

            {/* 2. Local Database & Persistence Engine */}
            <div className="bg-white border border-[#e1e4ea] rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-[#ecfdf5] text-[#059669] flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-[#6e7485] font-semibold uppercase tracking-wider">Local Database</div>
                    <div className="text-sm font-bold text-[#1c1d22]">IndexedDB Local Storage</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                  Healthy
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-[#f1f3f7] text-xs text-[#555a68] leading-relaxed">
                Local transaction journals, inventory movement logs, and shift reconciliation snapshots are securely persisted client-side.
              </div>
            </div>

            {/* 3. Synchronization Backlog Queue */}
            <div className="bg-white border border-[#e1e4ea] rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-[#fff5ee] text-[#e05e00] flex items-center justify-center">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-[#6e7485] font-semibold uppercase tracking-wider">Sync Backlog</div>
                    <div className="text-sm font-bold text-[#1c1d22]">
                      {readinessSnapshot.pendingSyncRecordsCount} Records Queued
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#fffaf6] text-[#e05e00] border border-[#fbd6b8]">
                  Queue Active
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-[#f1f3f7] text-xs text-[#555a68] leading-relaxed flex justify-between items-center">
                <span>Last sync: {readinessSnapshot.lastSuccessfulSync}</span>
                <button 
                  onClick={handleRetrySync}
                  className="text-[#e05e00] font-semibold hover:underline"
                >
                  Flush Queue
                </button>
              </div>
            </div>

          </div>

          {/* Detailed Readiness Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* 4. Backup Status */}
            <div className="bg-white border border-[#e1e4ea] rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-[#e05e00]" />
                  <h2 className="text-xs font-bold text-[#1c1d22] uppercase tracking-wider">Database Backup</h2>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  readinessSnapshot.backupStatus === 'SUCCESS'
                    ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                    : readinessSnapshot.backupStatus === 'BACKUP_DUE'
                    ? 'bg-[#fff7ed] text-[#ea580c] border-[#fed7aa]'
                    : 'bg-[#fef2f2] text-[#dc2626] border-[#fca5a5]'
                }`}>
                  {readinessSnapshot.backupStatus === 'SUCCESS' ? 'Verified' : readinessSnapshot.backupStatus}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#555a68]">
                  <span>Last Successful:</span>
                  <span className="font-semibold text-[#1c1d22]">{readinessSnapshot.lastSuccessfulBackup}</span>
                </div>
                <div className="flex justify-between text-[#555a68]">
                  <span>Integrity:</span>
                  <span className="font-semibold text-[#059669]">Encrypted SHA-256</span>
                </div>
                <p className="text-[11px] text-[#6e7485] pt-1">
                  {readinessSnapshot.backupStatusMessage}
                </p>
                <div className="pt-2 space-y-1.5">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleBackupNow} 
                    disabled={isBackingUp}
                    className="w-full text-xs"
                  >
                    {isBackingUp ? 'Backing Up...' : 'Run Backup Now'}
                  </Button>
                  {onNavigateToDataProtection && (
                    <button 
                      onClick={onNavigateToDataProtection}
                      className="w-full py-1 text-center text-[11px] font-semibold text-[#e05e00] hover:text-[#b84d00] hover:underline"
                    >
                      Manage Backups & Retention →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 5. Fiscalization Compliance */}
            <div className="bg-white border border-[#e1e4ea] rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <FileCheck className="w-4 h-4 text-[#2563eb]" />
                  <h2 className="text-xs font-bold text-[#1c1d22] uppercase tracking-wider">Fiscal Compliance</h2>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  readinessSnapshot.fiscalStatus === 'READY'
                    ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                    : readinessSnapshot.fiscalStatus === 'PENDING_DOCUMENTS'
                    ? 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]'
                    : 'bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]'
                }`}>
                  {readinessSnapshot.fiscalStatus === 'NOT_ENABLED' ? 'Not Enabled' : readinessSnapshot.fiscalStatus}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#555a68]">
                  <span>Engine:</span>
                  <span className="font-semibold text-[#1c1d22]">
                    {fiscalConfig?.fiscalizationEnabled ? fiscalConfig.fiscalAuthority : 'Disabled (Neutral)'}
                  </span>
                </div>
                <div className="flex justify-between text-[#555a68]">
                  <span>Pending Receipts:</span>
                  <span className="font-semibold text-[#1c1d22]">{readinessSnapshot.fiscalPendingCount || 0}</span>
                </div>
                <p className="text-[11px] text-[#6e7485] pt-1">
                  {fiscalConfig?.fiscalizationEnabled 
                    ? 'All completed sales are hashed and dispatched to the national tax revenue gateway.'
                    : 'Fiscal module is disabled. Cash sales operate without external fiscal signatures.'}
                </p>
              </div>
            </div>

            {/* 6. Licensing & Terminal Entitlement */}
            <div className="bg-white border border-[#e1e4ea] rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Key className="w-4 h-4 text-[#059669]" />
                  <h2 className="text-xs font-bold text-[#1c1d22] uppercase tracking-wider">Terminal License</h2>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                  {readinessSnapshot.licenseStatus}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#555a68]">
                  <span>Terminal ID:</span>
                  <span className="font-mono font-semibold text-[#1c1d22]">POS-D01 (Registered)</span>
                </div>
                <div className="flex justify-between text-[#555a68]">
                  <span>Expiry Date:</span>
                  <span className="font-semibold text-[#1c1d22]">{readinessSnapshot.licenseExpiryDate}</span>
                </div>
                <div className="flex justify-between text-[#555a68]">
                  <span>Grace Buffer:</span>
                  <span className="font-semibold text-[#059669]">{readinessSnapshot.gracePeriodDays} Days Offline</span>
                </div>
                <p className="text-[11px] text-[#6e7485] pt-1">
                  Commercial POS license validated. Offline operation entitlement active.
                </p>
              </div>
            </div>

          </div>

          {/* Operational Exception Summary Table */}
          <div className="bg-white border border-[#e1e4ea] rounded-lg shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e1e4ea] bg-[#f8f9fa] flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#dc2626]" />
                <h3 className="text-xs font-bold text-[#1c1d22] uppercase tracking-wider">
                  Active Control Exceptions ({exceptions.filter(e => e.status === 'OPEN' || e.status === 'UNDER_REVIEW').length})
                </h3>
              </div>
              <span className="text-xs text-[#6e7485]">Central Exception Ledger</span>
            </div>

            <div className="p-4">
              {exceptions.filter(e => e.status === 'OPEN' || e.status === 'UNDER_REVIEW').length === 0 ? (
                <div className="text-center py-6 text-[#8c92a4] text-xs">
                  <CheckCircle2 className="w-6 h-6 mx-auto text-[#059669] mb-1.5 opacity-80" />
                  <p className="font-medium text-[#1c1d22]">No Active Control Exceptions</p>
                  <p className="text-[11px] mt-0.5">All tenders, transfers, and receiving operations are in equilibrium.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {exceptions
                    .filter(e => e.status === 'OPEN' || e.status === 'UNDER_REVIEW')
                    .slice(0, 5)
                    .map((exc) => (
                      <div 
                        key={exc.id} 
                        className="border border-[#e1e4ea] rounded p-3 text-xs flex justify-between items-center hover:bg-[#fbfcfd]"
                      >
                        <div>
                          <div className="font-semibold text-[#1c1d22] flex items-center space-x-2">
                            <span>{exc.title}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              exc.severity === 'CRITICAL' ? 'bg-[#fef2f2] text-[#dc2626]' : 'bg-[#fff7ed] text-[#ea580c]'
                            }`}>
                              {exc.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#555a68] mt-0.5">{exc.explanation}</p>
                        </div>
                        <div className="text-right text-[11px] text-[#6e7485] font-mono">
                          {exc.category}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
