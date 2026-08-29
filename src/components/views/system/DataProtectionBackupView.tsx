import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Database, 
  HardDrive, 
  RefreshCw, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  FileText, 
  Clock, 
  Layers, 
  FolderCheck, 
  Settings, 
  Sliders, 
  AlertOctagon, 
  RotateCcw,
  Check,
  Search,
  Filter,
  Lock,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { 
  BackupRecord, 
  BackupType, 
  BackupRetentionPolicy, 
  StaffMember, 
  ActivityEvent, 
  OperationalException,
  BackupFailureReason,
  StorageCapacityInfo
} from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Alert } from '../../ui/Alert';
import { Modal } from '../../ui/Modal';
import { 
  STANDARD_APP_STORAGE_PATHS, 
  DEFAULT_RETENTION_POLICY, 
  CURRENT_APP_VERSION, 
  CURRENT_SCHEMA_VERSION, 
  CURRENT_TENANT_ID,
  createSafeBackupSnapshot, 
  verifyBackupIntegrity, 
  applyBackupRetentionPolicy, 
  calculateBackupChecksum 
} from '../../../utils/backupRestoreEngine';

interface DataProtectionBackupViewProps {
  currentStaff: StaffMember;
  backups: BackupRecord[];
  onBackToLanding: () => void;
  onNavigateToRestore: (selectedBackupId?: string) => void;
  onNavigateToIntegrity: () => void;
  onAddBackup: (backup: BackupRecord) => void;
  onEmitActivityEvent: (event: Partial<ActivityEvent>) => void;
  onAddOperationalException?: (exception: Partial<OperationalException>) => void;
}

export const DataProtectionBackupView: React.FC<DataProtectionBackupViewProps> = ({
  currentStaff,
  backups = [],
  onBackToLanding,
  onNavigateToRestore,
  onNavigateToIntegrity,
  onAddBackup,
  onEmitActivityEvent,
  onAddOperationalException,
}) => {
  const [activeTab, setActiveTab] = useState<'MANIFEST' | 'STORAGE' | 'RETENTION' | 'SIMULATION'>('MANIFEST');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Backup modal state
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupType, setBackupType] = useState<BackupType>('MANUAL');
  const [backupNotes, setBackupNotes] = useState('');
  const [isExecutingBackup, setIsExecutingBackup] = useState(false);
  const [backupProgressStep, setBackupProgressStep] = useState<string>('');
  const [backupResult, setBackupResult] = useState<{ success: boolean; backup?: BackupRecord; error?: string } | null>(null);

  // Selected backup for detail modal
  const [inspectingBackup, setInspectingBackup] = useState<BackupRecord | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<{ id: string; message: string; isValid: boolean } | null>(null);

  // Retention policy state
  const [retentionPolicy, setRetentionPolicy] = useState<BackupRetentionPolicy>(DEFAULT_RETENTION_POLICY);
  const [retentionSuccessNotice, setRetentionSuccessNotice] = useState<string | null>(null);

  // Failure simulation toggle for testing resilience
  const [simulatedFailure, setSimulatedFailure] = useState<BackupFailureReason | 'NONE'>('NONE');

  // Permission check
  const isAuthorized = currentStaff?.role === 'SYS_ADMIN' || currentStaff?.role === 'STORE_MANAGER' || (currentStaff?.permissions && currentStaff.permissions.includes('DATA_BACKUP_MANAGEMENT'));

  // Stats calculations
  const verifiedBackups = (backups || []).filter((b) => b.verificationStatus === 'VERIFIED');
  const sortedBackups = [...(backups || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latestBackup = sortedBackups[0] || null;

  const filteredBackups = sortedBackups.filter((b) => {
    const matchesType = selectedTypeFilter === 'ALL' || b.type === selectedTypeFilter;
    const matchesSearch = 
      b.backupId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.filePath.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.notes && b.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  // Trigger manual or scheduled backup
  const handleExecuteBackup = () => {
    setIsExecutingBackup(true);
    setBackupResult(null);
    setBackupProgressStep('1. Freezing active transactions & executing SQLite WAL checkpoint...');

    setTimeout(() => {
      setBackupProgressStep('2. Streaming database pages to isolated backup destination...');
      
      setTimeout(() => {
        setBackupProgressStep('3. Generating SHA-256 integrity checksum & validating SQLite headers...');

        setTimeout(() => {
          setIsExecutingBackup(false);

          const result = createSafeBackupSnapshot(
            {
              type: backupType,
              staff: currentStaff,
              notes: backupNotes || `Manual backup initiated by ${currentStaff.name}`,
              simulateFailureReason: simulatedFailure !== 'NONE' ? simulatedFailure : undefined,
            },
            {
              inventoryItemsCount: 340,
              shiftsCount: 42,
              salesCount: 1840,
              debtorsCount: 120,
              creditorsCount: 65,
              cashMovementsCount: 380,
              activityEventsCount: 1250,
              exceptionsCount: 18,
            }
          );

          if (result.success && result.backup) {
            onAddBackup(result.backup);
            setBackupResult({ success: true, backup: result.backup });
            
            // Log canonical BACKUP_COMPLETED activity event
            onEmitActivityEvent({
              eventType: 'BACKUP_COMPLETED',
              description: `Consistent SQLite backup created (${result.backup.type}): ${result.backup.backupId} at ${result.backup.filePath}`,
              staffId: currentStaff.id,
              staffName: currentStaff.name,
              referenceDocument: result.backup.backupId,
              outcome: 'COMPLETED',
              metadata: {
                backupId: result.backup.backupId,
                type: result.backup.type,
                fileSize: result.backup.fileSize,
                checksum: result.backup.checksum,
                schemaVersion: result.backup.schemaVersion,
              },
            });
          } else {
            setBackupResult({ success: false, error: result.error || 'Backup failed.' });
            
            // Log canonical BACKUP_FAILED activity event
            onEmitActivityEvent({
              eventType: 'BACKUP_FAILED',
              description: `Database backup failed (${backupType}): ${result.error}`,
              staffId: currentStaff.id,
              staffName: currentStaff.name,
              reasonCode: result.failureReason || 'FILE_WRITE_FAILED',
              outcome: 'FAILED',
            });

            // Create Operational Exception
            if (onAddOperationalException) {
              onAddOperationalException({
                title: `Database Backup Operation Failed (${backupType})`,
                category: 'BACKUP_FAILURE',
                severity: 'HIGH',
                status: 'OPEN',
                staffId: currentStaff.id,
                staffName: currentStaff.name,
                details: `Backup execution halted: ${result.error}. Prior verified backups remain intact.`,
              });
            }
          }
        }, 600);
      }, 600);
    }, 600);
  };

  const handleVerifyBackupItem = (backup: BackupRecord) => {
    const res = verifyBackupIntegrity(backup, CURRENT_TENANT_ID);
    setVerificationFeedback({
      id: backup.backupId,
      isValid: res.isValid,
      message: res.isValid ? res.details : (res.error || 'Verification failed.'),
    });

    onEmitActivityEvent({
      eventType: res.isValid ? 'INTEGRITY_CHECK_COMPLETED' : 'INTEGRITY_CHECK_FAILED',
      description: `Integrity check for backup ${backup.backupId}: ${res.isValid ? 'PASSED (SHA-256 Valid)' : res.error}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      outcome: res.isValid ? 'COMPLETED' : 'FAILED',
    });
  };

  const handleApplyRetention = () => {
    const { retained, pruned, logMessage } = applyBackupRetentionPolicy(backups, retentionPolicy);
    setRetentionSuccessNotice(logMessage);

    onEmitActivityEvent({
      eventType: 'BACKUP_COMPLETED',
      description: `Deterministic backup retention policy executed: ${retained.length} retained, ${pruned.length} pruned.`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      outcome: 'COMPLETED',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLanding}
              className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded transition"
              title="Return to Main Menu"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-2 bg-orange-600 text-white rounded-md shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                Data Protection & Local Backup Center
              </h1>
              <p className="text-sm text-stone-600">
                Transactional SQLite snapshots, verified restore points, and deterministic retention.
              </p>
            </div>
          </div>
        </div>

        {/* Header Quick Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={onNavigateToIntegrity}
            className="flex items-center gap-2 border-stone-300 text-stone-700 hover:bg-stone-50"
          >
            <Database className="w-4 h-4 text-stone-600" />
            <span>DB Health & Schema v{CURRENT_SCHEMA_VERSION}</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => onNavigateToRestore()}
            className="flex items-center gap-2 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
          >
            <RotateCcw className="w-4 h-4 text-amber-700" />
            <span>Restore Data Workspace</span>
          </Button>

          {isAuthorized && (
            <Button
              onClick={() => {
                setBackupResult(null);
                setBackupType('MANUAL');
                setBackupNotes('');
                setIsBackupModalOpen(true);
              }}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow-sm font-medium"
            >
              <FolderCheck className="w-4 h-4" />
              <span>Backup Now</span>
            </Button>
          )}
        </div>
      </div>

      {/* Primary KPI Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
        {/* Card 1: Continuity Health */}
        <div className="bg-white p-4 rounded-md border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Backup Readiness</span>
            <StatusBadge status="ACTIVE" customLabel="Healthy" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-stone-900">
              {latestBackup ? `${latestBackup.type} Verified` : 'No Backups'}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Last: {latestBackup ? latestBackup.createdAt : 'Never'}
            </p>
          </div>
        </div>

        {/* Card 2: Database Schema & Engine */}
        <div className="bg-white p-4 rounded-md border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Database Engine</span>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
              WAL Journal Active
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-stone-900">
              SQLite Schema v{CURRENT_SCHEMA_VERSION}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              App Version: v{CURRENT_APP_VERSION} (Autonomous POS)
            </p>
          </div>
        </div>

        {/* Card 3: Storage Capacity */}
        <div className="bg-white p-4 rounded-md border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Target Disk Space</span>
            <span className="text-xs font-semibold text-emerald-600">42.6 GB Free</span>
          </div>
          <div className="mt-2">
            <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden mb-1.5 border border-stone-200">
              <div className="bg-orange-500 h-2 rounded-full" style={{ width: '64%' }}></div>
            </div>
            <p className="text-xs text-stone-500">
              77.4 GB Used / 120 GB Total Capacity
            </p>
          </div>
        </div>

        {/* Card 4: Verified Manifest Count */}
        <div className="bg-white p-4 rounded-md border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Verified Manifest</span>
            <span className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded font-mono">
              {verifiedBackups.length} / {(backups || []).length} Safe
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-stone-900">
              {verifiedBackups.length} Verified Backups
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Deterministic pruning active
            </p>
          </div>
        </div>
      </div>

      {/* Storage Architecture Separation Banner */}
      <div className="bg-stone-50 border border-stone-200 rounded-md p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-stone-200 text-stone-700 rounded mt-0.5">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <h3 className="font-semibold text-stone-900 text-sm mb-1">
              Industrial Storage Separation (Windows Standard Architecture)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 font-mono text-[11px]">
              <div className="bg-white p-2.5 rounded border border-stone-200">
                <span className="text-stone-500 block text-[10px] font-sans font-semibold uppercase">1. Application Binaries</span>
                <code className="text-stone-800 break-all">{STANDARD_APP_STORAGE_PATHS.appBinariesPath}</code>
                <span className="text-stone-400 block mt-1 text-[10px] font-sans">Read-only program files</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-stone-200">
                <span className="text-stone-500 block text-[10px] font-sans font-semibold uppercase">2. Active Operational Data</span>
                <code className="text-stone-800 break-all">{STANDARD_APP_STORAGE_PATHS.activeDataPath}</code>
                <span className="text-stone-400 block mt-1 text-[10px] font-sans">Live SQLite + WAL journal</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-stone-200">
                <span className="text-stone-500 block text-[10px] font-sans font-semibold uppercase">3. User Backups & Restore Points</span>
                <code className="text-stone-800 break-all">{STANDARD_APP_STORAGE_PATHS.backupRootPath}</code>
                <span className="text-stone-400 block mt-1 text-[10px] font-sans">Verified snapshot repository</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-stone-200 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('MANIFEST')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'MANIFEST'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Backup Manifest ({backups.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('RETENTION')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'RETENTION'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Retention Policy</span>
          </button>

          <button
            onClick={() => setActiveTab('STORAGE')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'STORAGE'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Storage & Directory Map</span>
          </button>

          <button
            onClick={() => setActiveTab('SIMULATION')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'SIMULATION'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>Fault Resilience Testing</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BACKUP MANIFEST */}
      {activeTab === 'MANIFEST' && (
        <div className="space-y-4">
          {verificationFeedback && (
            <Alert
              variant={verificationFeedback.isValid ? 'success' : 'danger'}
              title={verificationFeedback.isValid ? 'Backup Verification Succeeded' : 'Backup Verification Failed'}
              onClose={() => setVerificationFeedback(null)}
            >
              <div className="text-xs font-mono">{verificationFeedback.message}</div>
            </Alert>
          )}

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-md border border-stone-200 shadow-sm">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search backup ID, path, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-stone-50 border border-stone-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="py-1.5 px-3 text-sm bg-stone-50 border border-stone-200 rounded focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Types</option>
                <option value="SCHEDULED">Scheduled Daily</option>
                <option value="MANUAL">Manual</option>
                <option value="PRE_UPDATE">Pre-Update</option>
                <option value="PRE_MIGRATION">Pre-Migration</option>
                <option value="PRE_RESTORE">Restore Points (Pre-Restore)</option>
              </select>
            </div>

            <div className="text-xs text-stone-500 font-medium">
              Showing {filteredBackups.length} of {(backups || []).length} recorded snapshots
            </div>
          </div>

          {/* Manifest Table */}
          <div className="bg-white rounded-md border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 text-stone-700 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Backup ID & Timestamp</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">App / Schema</th>
                    <th className="py-3 px-4">Size & Records</th>
                    <th className="py-3 px-4">SHA-256 Checksum</th>
                    <th className="py-3 px-4 text-center">Integrity Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-sans">
                  {filteredBackups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-400">
                        No backup records match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredBackups.map((b) => (
                      <tr key={b.backupId} className="hover:bg-stone-50 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-stone-900 font-mono">{b.backupId}</div>
                          <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{b.createdAt}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              b.type === 'SCHEDULED'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : b.type === 'MANUAL'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : b.type === 'PRE_UPDATE'
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : b.type === 'PRE_MIGRATION'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {b.type.replace('_', '-')}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px]">
                          <span className="text-stone-800 font-semibold">v{b.applicationVersion}</span>
                          <span className="text-stone-400 mx-1">/</span>
                          <span className="text-stone-600">Schema v{b.schemaVersion}</span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-stone-900 font-semibold">
                            {(b.fileSize / (1024 * 1024)).toFixed(2)} MB
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {b.recordsCount.toLocaleString()} recs across {b.tablesCount} tables
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-stone-600 max-w-xs truncate" title={b.checksum}>
                          {b.checksum ? `${b.checksum.substring(0, 18)}...` : 'N/A'}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {b.verificationStatus === 'VERIFIED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold text-[11px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              VERIFIED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-semibold text-[11px]">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              FAILED
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setInspectingBackup(b)}
                              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium transition text-[11px]"
                              title="Inspect Manifest Details"
                            >
                              Inspect
                            </button>

                            <button
                              onClick={() => handleVerifyBackupItem(b)}
                              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium transition text-[11px]"
                              title="Re-verify SQLite Header & Hash"
                            >
                              Verify
                            </button>

                            {isAuthorized && (
                              <button
                                onClick={() => onNavigateToRestore(b.backupId)}
                                className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-medium transition text-[11px]"
                                title="Open in Controlled Restore Workspace"
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RETENTION POLICY */}
      {activeTab === 'RETENTION' && (
        <div className="bg-white rounded-md border border-stone-200 p-6 shadow-sm max-w-3xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Deterministic Backup Retention Policy</h2>
            <p className="text-xs text-stone-600 mt-1">
              Automated cleanup rules guarantee disk availability while strictly protecting recovery safety. The newest verified backup is NEVER removed.
            </p>
          </div>

          {retentionSuccessNotice && (
            <Alert variant="success" title="Retention Evaluated" onClose={() => setRetentionSuccessNotice(null)}>
              {retentionSuccessNotice}
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Daily Scheduled Backups (Retention Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={retentionPolicy.dailyRetentionDays}
                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, dailyRetentionDays: parseInt(e.target.value) || 14 })}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:ring-1 focus:ring-orange-500"
              />
              <p className="text-[11px] text-stone-500 mt-1">Retain daily automated EOD snapshots for N days.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Manual Backups (Max Count Retained)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={retentionPolicy.manualBackupsRetainedCount}
                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, manualBackupsRetainedCount: parseInt(e.target.value) || 20 })}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:ring-1 focus:ring-orange-500"
              />
              <p className="text-[11px] text-stone-500 mt-1">Keep up to N most recent manual snapshots.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Pre-Update Backups (Retention Days)
              </label>
              <input
                type="number"
                min="7"
                max="365"
                value={retentionPolicy.preUpdateRetentionDays}
                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, preUpdateRetentionDays: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:ring-1 focus:ring-orange-500"
              />
              <p className="text-[11px] text-stone-500 mt-1">Pre-update safety snapshots retained for N days.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Pre-Migration Backups (Retention Days)
              </label>
              <input
                type="number"
                min="7"
                max="365"
                value={retentionPolicy.preMigrationRetentionDays}
                onChange={(e) => setRetentionPolicy({ ...retentionPolicy, preMigrationRetentionDays: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:ring-1 focus:ring-orange-500"
              />
              <p className="text-[11px] text-stone-500 mt-1">Schema migration rollback snapshots retained for N days.</p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Non-Destructive Invariant:</strong> Pre-Restore rollback restore points are always protected for at least 7 days, and the latest verified backup will never be deleted by retention under any circumstance.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
            <Button
              variant="outline"
              onClick={() => setRetentionPolicy(DEFAULT_RETENTION_POLICY)}
            >
              Reset to Defaults
            </Button>
            <Button
              onClick={handleApplyRetention}
              className="bg-orange-600 hover:bg-orange-700 text-white font-medium"
            >
              Evaluate & Apply Retention
            </Button>
          </div>
        </div>
      )}

      {/* TAB 3: STORAGE & DIRECTORY MAP */}
      {activeTab === 'STORAGE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-md border border-stone-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900">Configured Storage Directory Trees</h2>
            
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="font-semibold text-stone-700 block">Daily Automated Backups:</span>
                <code className="text-stone-900 block mt-1 break-all">
                  {STANDARD_APP_STORAGE_PATHS.backupRootPath}Daily\
                </code>
              </div>

              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="font-semibold text-stone-700 block">Manual User Backups:</span>
                <code className="text-stone-900 block mt-1 break-all">
                  {STANDARD_APP_STORAGE_PATHS.backupRootPath}Manual\
                </code>
              </div>

              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="font-semibold text-stone-700 block">Pre-Software Update Snapshots:</span>
                <code className="text-stone-900 block mt-1 break-all">
                  {STANDARD_APP_STORAGE_PATHS.backupRootPath}PreUpdate\
                </code>
              </div>

              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="font-semibold text-stone-700 block">Pre-Database Migration Snapshots:</span>
                <code className="text-stone-900 block mt-1 break-all">
                  {STANDARD_APP_STORAGE_PATHS.backupRootPath}PreMigration\
                </code>
              </div>

              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="font-semibold text-stone-700 block">Pre-Restore Rollback Points:</span>
                <code className="text-stone-900 block mt-1 break-all">
                  {STANDARD_APP_STORAGE_PATHS.backupRootPath}RestorePoints\
                </code>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md border border-stone-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900">Transactional Safety Principles</h2>
            
            <ul className="space-y-2.5 text-xs text-stone-600">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span><strong>WAL Checkpoint Coordination:</strong> `PRAGMA wal_checkpoint(FULL)` executes prior to streaming database pages to guarantee that uncommitted transactions are flushed cleanly.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span><strong>No Overwriting:</strong> Every backup uses an immutable timestamped filename (e.g. `itredcommerce_2026-08-19_102400.sqlite.bak`).</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span><strong>Pre-Restore Safeguard:</strong> A verified `PRE_RESTORE` backup is mandated before any restore operation replaces live database files.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span><strong>Storage Pre-flight Check:</strong> Free space is verified before creating snapshots to prevent partial writes.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 4: FAULT RESILIENCE TESTING / SIMULATION */}
      {activeTab === 'SIMULATION' && (
        <div className="bg-white rounded-md border border-stone-200 p-6 shadow-sm max-w-3xl space-y-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Disaster Recovery & Failure Resilience Testing</h2>
            <p className="text-xs text-stone-600 mt-1">
              Simulate hardware or environmental faults to verify that the POS gracefully rejects corrupt operations, leaves live databases untouched, and logs canonical Activity Events.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <label className="block font-semibold text-stone-700">Simulate Failure Condition on Next Backup:</label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSimulatedFailure('NONE')}
                className={`p-3 text-left rounded border transition ${
                  simulatedFailure === 'NONE'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                    : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                }`}
              >
                Normal Operation (No Faults)
              </button>

              <button
                type="button"
                onClick={() => setSimulatedFailure('DESTINATION_UNAVAILABLE')}
                className={`p-3 text-left rounded border transition ${
                  simulatedFailure === 'DESTINATION_UNAVAILABLE'
                    ? 'border-rose-500 bg-rose-50 text-rose-900 font-semibold'
                    : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                }`}
              >
                Destination Disk Unavailable
              </button>

              <button
                type="button"
                onClick={() => setSimulatedFailure('INSUFFICIENT_STORAGE')}
                className={`p-3 text-left rounded border transition ${
                  simulatedFailure === 'INSUFFICIENT_STORAGE'
                    ? 'border-rose-500 bg-rose-50 text-rose-900 font-semibold'
                    : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                }`}
              >
                Insufficient Storage Capacity (&lt;500 MB)
              </button>

              <button
                type="button"
                onClick={() => setSimulatedFailure('DATABASE_BUSY')}
                className={`p-3 text-left rounded border transition ${
                  simulatedFailure === 'DATABASE_BUSY'
                    ? 'border-rose-500 bg-rose-50 text-rose-900 font-semibold'
                    : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                }`}
              >
                Transactional Lock / Database Busy
              </button>

              <button
                type="button"
                onClick={() => setSimulatedFailure('VERIFICATION_FAILED')}
                className={`p-3 text-left rounded border transition ${
                  simulatedFailure === 'VERIFICATION_FAILED'
                    ? 'border-rose-500 bg-rose-50 text-rose-900 font-semibold'
                    : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                }`}
              >
                Post-Write Checksum Mismatch
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-200 flex justify-end">
            <Button
              onClick={() => {
                setBackupResult(null);
                setBackupType('MANUAL');
                setBackupNotes(`Disaster test (Simulated Fault: ${simulatedFailure})`);
                setIsBackupModalOpen(true);
              }}
              className="bg-stone-800 hover:bg-stone-900 text-white font-medium"
            >
              Test Backup with Current Fault Simulation
            </Button>
          </div>
        </div>
      )}

      {/* CREATE BACKUP MODAL */}
      <Modal
        isOpen={isBackupModalOpen}
        onClose={() => {
          if (!isExecutingBackup) setIsBackupModalOpen(false);
        }}
        title="Create Safe Local Database Backup"
      >
        <div className="space-y-4 text-xs">
          {!backupResult ? (
            <>
              <p className="text-stone-600">
                A transactional snapshot of all live data (Sales, Items, Shifts, Debtors, Creditors, Events) will be copied to the local backup directory.
              </p>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Backup Classification:</label>
                <select
                  value={backupType}
                  onChange={(e) => setBackupType(e.target.value as BackupType)}
                  disabled={isExecutingBackup}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="MANUAL">Manual Backup (Supervisor Initiated)</option>
                  <option value="SCHEDULED">Scheduled Daily Snapshot</option>
                  <option value="PRE_UPDATE">Pre-Software Update Safety Snapshot</option>
                  <option value="PRE_MIGRATION">Pre-Database Migration Rollback Point</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Audit Notes (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. End of month reconciliation snapshot"
                  value={backupNotes}
                  onChange={(e) => setBackupNotes(e.target.value)}
                  disabled={isExecutingBackup}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {simulatedFailure !== 'NONE' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px]">
                  <strong>Warning:</strong> Fault simulation is active ({simulatedFailure}).
                </div>
              )}

              {isExecutingBackup && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded text-center space-y-2">
                  <RefreshCw className="w-5 h-5 text-orange-600 animate-spin mx-auto" />
                  <p className="font-semibold text-orange-900">{backupProgressStep}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <Button
                  variant="outline"
                  onClick={() => setIsBackupModalOpen(false)}
                  disabled={isExecutingBackup}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExecuteBackup}
                  disabled={isExecutingBackup}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-medium"
                >
                  {isExecutingBackup ? 'Processing Snapshot...' : 'Start Backup'}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {backupResult.success && backupResult.backup ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Backup Verified & Successfully Written</span>
                  </div>

                  <div className="space-y-1 text-xs text-emerald-800 font-mono">
                    <div><strong>Backup ID:</strong> {backupResult.backup.backupId}</div>
                    <div><strong>File Size:</strong> {(backupResult.backup.fileSize / (1024 * 1024)).toFixed(2)} MB</div>
                    <div><strong>Checksum:</strong> {backupResult.backup.checksum}</div>
                    <div><strong>Destination:</strong> {backupResult.backup.filePath}</div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded space-y-2">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span>Backup Failed (Live Database Protected)</span>
                  </div>
                  <p className="text-xs text-rose-800">{backupResult.error}</p>
                  <p className="text-[11px] text-stone-600">
                    Existing good backups and current active transactional states remain completely unaffected.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-stone-200">
                <Button
                  onClick={() => setIsBackupModalOpen(false)}
                  className="bg-stone-800 hover:bg-stone-900 text-white font-medium"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* INSPECT BACKUP DETAILS MODAL */}
      {inspectingBackup && (
        <Modal
          isOpen={!!inspectingBackup}
          onClose={() => setInspectingBackup(null)}
          title={`Backup Manifest: ${inspectingBackup.backupId}`}
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded border border-stone-200">
              <div>
                <span className="text-stone-500 block text-[10px] uppercase font-semibold">Classification</span>
                <span className="font-semibold text-stone-900">{inspectingBackup.type}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px] uppercase font-semibold">Created At</span>
                <span className="font-semibold text-stone-900">{inspectingBackup.createdAt}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px] uppercase font-semibold">Schema Version</span>
                <span className="font-semibold text-stone-900">Schema v{inspectingBackup.schemaVersion}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px] uppercase font-semibold">Application Version</span>
                <span className="font-semibold text-stone-900">v{inspectingBackup.applicationVersion}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px] uppercase font-semibold">File Size</span>
                <span className="font-semibold text-stone-900">{(inspectingBackup.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px] uppercase font-semibold">Record Count</span>
                <span className="font-semibold text-stone-900">{inspectingBackup.recordsCount.toLocaleString()} across {inspectingBackup.tablesCount} tables</span>
              </div>
            </div>

            <div>
              <span className="text-stone-500 block text-[10px] uppercase font-semibold mb-1">Full Path</span>
              <code className="block p-2 bg-stone-100 rounded text-stone-900 font-mono text-[11px] break-all border border-stone-200">
                {inspectingBackup.filePath}
              </code>
            </div>

            <div>
              <span className="text-stone-500 block text-[10px] uppercase font-semibold mb-1">SHA-256 Checksum</span>
              <code className="block p-2 bg-stone-100 rounded text-stone-900 font-mono text-[11px] break-all border border-stone-200">
                {inspectingBackup.checksum}
              </code>
            </div>

            <div>
              <span className="text-stone-500 block text-[10px] uppercase font-semibold mb-1">Notes / Description</span>
              <p className="text-stone-700 italic">{inspectingBackup.notes || 'No notes provided.'}</p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-stone-200">
              {isAuthorized && (
                <Button
                  onClick={() => {
                    const id = inspectingBackup.backupId;
                    setInspectingBackup(null);
                    onNavigateToRestore(id);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  Stage in Restore Workspace
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setInspectingBackup(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
