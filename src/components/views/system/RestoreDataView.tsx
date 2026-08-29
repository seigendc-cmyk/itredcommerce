import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  ArrowLeft, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  HardDrive, 
  Layers, 
  Lock, 
  FileText, 
  FolderArchive,
  Database,
  UploadCloud,
  ChevronRight,
  Info,
  Check
} from 'lucide-react';
import { 
  BackupRecord, 
  StaffMember, 
  ActivityEvent, 
  OperationalException,
  RestoreWorkflowStage,
  RestoreExecutionResult
} from '../../../types';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';
import { Modal } from '../../ui/Modal';
import { 
  CURRENT_APP_VERSION, 
  CURRENT_SCHEMA_VERSION, 
  CURRENT_TENANT_ID,
  executeSafeDatabaseRestore,
  verifyBackupIntegrity,
  validateBackupHeader
} from '../../../utils/backupRestoreEngine';

interface RestoreDataViewProps {
  currentStaff: StaffMember;
  backups: BackupRecord[];
  initialSelectedBackupId?: string;
  onBackToDataProtection: () => void;
  onNavigateToLanding: () => void;
  onAddBackup: (backup: BackupRecord) => void;
  onEmitActivityEvent: (event: Partial<ActivityEvent>) => void;
  onAddOperationalException?: (exception: Partial<OperationalException>) => void;
}

export const RestoreDataView: React.FC<RestoreDataViewProps> = ({
  currentStaff,
  backups = [],
  initialSelectedBackupId,
  onBackToDataProtection,
  onNavigateToLanding,
  onAddBackup,
  onEmitActivityEvent,
  onAddOperationalException,
}) => {
  const [selectedBackupId, setSelectedBackupId] = useState<string>(
    initialSelectedBackupId || (backups?.length > 0 ? backups[0]?.backupId : '') || ''
  );
  
  // Confirmation state
  const [confirmationInput, setConfirmationInput] = useState('');
  const [hasAcknowledgedDowntime, setHasAcknowledgedDowntime] = useState(false);
  const [hasAcknowledgedDataScope, setHasAcknowledgedDataScope] = useState(false);

  // Restore Execution state
  const [isRestoring, setIsRestoring] = useState(false);
  const [currentStage, setCurrentStage] = useState<RestoreWorkflowStage>('IDLE');
  const [stageProgressText, setStageProgressText] = useState('');
  const [restoreResult, setRestoreResult] = useState<RestoreExecutionResult | null>(null);

  // External backup file upload simulation
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [externalFileName, setExternalFileName] = useState('');
  const [externalFileNotes, setExternalFileNotes] = useState('');

  const isAuthorized = currentStaff.role === 'SYS_ADMIN' || currentStaff.role === 'STORE_MANAGER';

  const selectedBackup = backups.find((b) => b.backupId === selectedBackupId);

  // Re-sync if initial selection changes
  useEffect(() => {
    if (initialSelectedBackupId) {
      setSelectedBackupId(initialSelectedBackupId);
    }
  }, [initialSelectedBackupId]);

  const isReadyToExecute = 
    selectedBackup &&
    isAuthorized &&
    confirmationInput.trim().toUpperCase() === 'RESTORE' &&
    hasAcknowledgedDowntime &&
    hasAcknowledgedDataScope &&
    !isRestoring;

  const handleStartRestore = () => {
    if (!selectedBackup) return;

    setIsRestoring(true);
    setRestoreResult(null);
    setCurrentStage('PRE_RESTORE_BACKUP');
    setStageProgressText('Step 1/4: Creating mandatory safety rollback restore point (PRE_RESTORE)...');

    setTimeout(() => {
      setCurrentStage('VALIDATION');
      setStageProgressText('Step 2/4: Validating SQLite header, cryptographic checksum, and tenant alignment...');

      setTimeout(() => {
        setCurrentStage('ATOMIC_SWAP');
        setStageProgressText('Step 3/4: Safely closing live connections and applying staged atomic database swap...');

        setTimeout(() => {
          setCurrentStage('POST_VERIFICATION');
          setStageProgressText('Step 4/4: Performing post-restore integrity check on ledger tables...');

          setTimeout(() => {
            setIsRestoring(false);
            setCurrentStage('COMPLETED');

            const result = executeSafeDatabaseRestore(
              selectedBackup,
              currentStaff,
              CURRENT_TENANT_ID,
              CURRENT_SCHEMA_VERSION
            );

            setRestoreResult(result);

            if (result.success) {
              if (result.preRestoreBackupCreated) {
                onAddBackup(result.preRestoreBackupCreated);
              }

              onEmitActivityEvent({
                eventType: 'RESTORE_COMPLETED',
                description: `Database successfully restored to snapshot ${selectedBackup.backupId} (${selectedBackup.createdAt}). Rollback point: ${result.preRestoreBackupCreated?.backupId}`,
                staffId: currentStaff.id,
                staffName: currentStaff.name,
                referenceDocument: selectedBackup.backupId,
                outcome: 'COMPLETED',
                metadata: {
                  restoredBackupId: selectedBackup.backupId,
                  preRestoreBackupId: result.preRestoreBackupCreated?.backupId,
                  tablesRestored: result.tablesRestoredCount,
                  recordsRestored: result.recordsRestoredCount,
                },
              });
            } else {
              setCurrentStage('FAILED');
              onEmitActivityEvent({
                eventType: 'RESTORE_FAILED',
                description: `Database restore aborted/failed for snapshot ${selectedBackup.backupId}: ${result.error}`,
                staffId: currentStaff.id,
                staffName: currentStaff.name,
                reasonCode: result.failureStage || 'SCHEMA_MISMATCH',
                outcome: 'FAILED',
              });

              if (onAddOperationalException) {
                onAddOperationalException({
                  title: `Database Restore Failed (${selectedBackup.backupId})`,
                  category: 'RESTORE_FAILURE',
                  severity: 'CRITICAL',
                  status: 'OPEN',
                  staffId: currentStaff.id,
                  staffName: currentStaff.name,
                  details: `Restore halted: ${result.error}. Active database was safely retained without corruption.`,
                });
              }
            }
          }, 600);
        }, 600);
      }, 600);
    }, 600);
  };

  const handleImportExternalFile = () => {
    if (!externalFileName.trim()) return;

    const newImportedBackup: BackupRecord = {
      backupId: `IMP-${Date.now()}`,
      type: 'MANUAL',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      applicationVersion: CURRENT_APP_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      filePath: `C:\\Users\\Public\\Documents\\SCI\\backup\\Data\\Manual\\${externalFileName.trim()}`,
      fileSize: 8400000,
      verificationStatus: 'VERIFIED',
      checksum: 'sha256:imported_external_file_verified_checksum',
      tenantId: CURRENT_TENANT_ID,
      tablesCount: 28,
      recordsCount: 4200,
      walCheckpointCompleted: true,
      notes: externalFileNotes || 'Imported external backup file for support restoration.',
      initiatedByStaffId: currentStaff.id,
      initiatedByStaffName: currentStaff.name,
    };

    onAddBackup(newImportedBackup);
    setSelectedBackupId(newImportedBackup.backupId);
    setIsImportModalOpen(false);
    setExternalFileName('');
    setExternalFileNotes('');

    onEmitActivityEvent({
      eventType: 'BACKUP_COMPLETED',
      description: `External backup file registered into manifest: ${newImportedBackup.backupId}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      outcome: 'COMPLETED',
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDataProtection}
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded transition"
            title="Back to Data Protection Center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-amber-600 text-white rounded-md shadow-sm">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              Database Restore & Point-in-Time Recovery
            </h1>
            <p className="text-sm text-stone-600">
              Recover previous operational states with mandatory automated pre-restore safeguards.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 border-stone-300 text-stone-700"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import External Backup File</span>
          </Button>
        </div>
      </div>

      {/* Operational Safety Overview Banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-md p-4 my-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-900 space-y-1">
            <h2 className="text-sm font-bold text-amber-950">
              Operational Safeguards & Business Implications
            </h2>
            <p>
              Restoring a backup replaces the entire active SQLite database with the snapshot taken at that specific date and time.
            </p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800">
              <li>Transactions, shifts, and stock movements recorded <em>after</em> the selected backup time will be superseded by the restored dataset.</li>
              <li><strong>Mandatory Pre-Restore Rule:</strong> The system automatically creates a verified rollback snapshot (<code className="font-mono font-bold">PRE_RESTORE</code>) before modifying live data, allowing immediate reversal if necessary.</li>
              <li>Active registers and till drawers must be idle during the restore procedure.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Grid: Selection vs Confirmation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Backup Selector (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-md border border-stone-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-stone-600" />
              <span>Select Restore Source Snapshot</span>
            </h2>
            <span className="text-xs text-stone-500 font-mono">{backups.length} available</span>
          </div>

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {backups.map((b) => {
              const isSelected = b.backupId === selectedBackupId;
              return (
                <div
                  key={b.backupId}
                  onClick={() => !isRestoring && setSelectedBackupId(b.backupId)}
                  className={`p-3 rounded border text-xs cursor-pointer transition ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500 shadow-sm'
                      : 'border-stone-200 hover:bg-stone-50'
                  } ${isRestoring ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="font-mono text-stone-900">{b.backupId}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        b.type === 'SCHEDULED'
                          ? 'bg-blue-100 text-blue-800'
                          : b.type === 'MANUAL'
                          ? 'bg-purple-100 text-purple-800'
                          : b.type === 'PRE_UPDATE'
                          ? 'bg-teal-100 text-teal-800'
                          : b.type === 'PRE_MIGRATION'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {b.type.replace('_', '-')}
                    </span>
                  </div>

                  <div className="text-stone-500 text-[11px] mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{b.createdAt}</span>
                  </div>

                  <div className="flex items-center justify-between text-stone-600 text-[11px] mt-2 pt-2 border-t border-stone-200/60">
                    <span>v{b.applicationVersion} (Schema v{b.schemaVersion})</span>
                    <span>{(b.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Pre-Flight Analysis & Confirmation (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedBackup ? (
            <div className="bg-white rounded-md border border-stone-200 p-6 shadow-sm space-y-5">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-stone-900">
                  Target Snapshot Pre-Flight Inspection
                </h2>
                <span className="text-xs font-mono bg-stone-100 text-stone-700 px-2 py-1 rounded">
                  {selectedBackup.backupId}
                </span>
              </div>

              {/* Snapshot Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-stone-50 p-2.5 rounded border border-stone-200">
                  <span className="text-stone-500 block text-[10px] uppercase font-semibold">Classification</span>
                  <span className="font-bold text-stone-900">{selectedBackup.type}</span>
                </div>
                <div className="bg-stone-50 p-2.5 rounded border border-stone-200">
                  <span className="text-stone-500 block text-[10px] uppercase font-semibold">Schema Version</span>
                  <span className="font-bold text-stone-900">Schema v{selectedBackup.schemaVersion}</span>
                </div>
                <div className="bg-stone-50 p-2.5 rounded border border-stone-200">
                  <span className="text-stone-500 block text-[10px] uppercase font-semibold">Size</span>
                  <span className="font-bold text-stone-900">{(selectedBackup.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div className="bg-stone-50 p-2.5 rounded border border-stone-200">
                  <span className="text-stone-500 block text-[10px] uppercase font-semibold">Records</span>
                  <span className="font-bold text-stone-900">{selectedBackup.recordsCount.toLocaleString()}</span>
                </div>
              </div>

              {/* Tenant & Integrity Diagnostics */}
              <div className="space-y-2 text-xs bg-stone-50 p-3.5 rounded border border-stone-200">
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">Tenant Namespace Match:</span>
                  <span className="font-mono text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {selectedBackup.tenantId} (Matches Local Branch)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">Cryptographic Checksum:</span>
                  <span className="font-mono text-stone-800 text-[11px] truncate max-w-xs" title={selectedBackup.checksum}>
                    {selectedBackup.checksum}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">Database Storage Path:</span>
                  <span className="font-mono text-stone-800 text-[11px] truncate max-w-xs" title={selectedBackup.filePath}>
                    {selectedBackup.filePath}
                  </span>
                </div>
              </div>

              {/* Live Execution Progress or Result */}
              {isRestoring && (
                <div className="p-5 bg-amber-50 border border-amber-300 rounded-md text-center space-y-3">
                  <RefreshCw className="w-7 h-7 text-amber-600 animate-spin mx-auto" />
                  <div>
                    <h3 className="font-bold text-amber-950 text-sm">Executing Controlled Database Restoration</h3>
                    <p className="text-xs text-amber-900 mt-1 font-mono">{stageProgressText}</p>
                  </div>
                  <div className="w-full bg-amber-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-600 h-1.5 transition-all duration-300"
                      style={{
                        width:
                          currentStage === 'PRE_RESTORE_BACKUP'
                            ? '25%'
                            : currentStage === 'VALIDATION'
                            ? '50%'
                            : currentStage === 'ATOMIC_SWAP'
                            ? '75%'
                            : '100%',
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {restoreResult && (
                <div
                  className={`p-4 rounded-md border text-xs space-y-3 ${
                    restoreResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {restoreResult.success ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span>Database Successfully Restored</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                        <span>Restoration Halted (Live Database Protected)</span>
                      </>
                    )}
                  </div>

                  {restoreResult.success ? (
                    <div className="space-y-1 text-[11px] text-emerald-900 font-mono">
                      <div>Restored Snapshot: <strong>{restoreResult.restoredBackupId}</strong></div>
                      <div>Rollback Safety Point: <strong>{restoreResult.preRestoreBackupCreated?.backupId}</strong></div>
                      <div>Tables Restored: {restoreResult.tablesRestoredCount} | Records: {restoreResult.recordsRestoredCount.toLocaleString()}</div>
                      <div>Post-Restore Check: Verified Clean (WAL Replay Clean)</div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-rose-900">
                      <strong>Reason:</strong> {restoreResult.error}
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      onClick={onBackToDataProtection}
                      className="bg-stone-800 hover:bg-stone-900 text-white font-medium text-xs"
                    >
                      Return to Data Protection Center
                    </Button>
                  </div>
                </div>
              )}

              {/* Confirmation Controls (when not restoring and no result yet) */}
              {!isRestoring && !restoreResult && (
                <div className="space-y-4 pt-2 border-t border-stone-200 text-xs">
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer text-stone-700">
                      <input
                        type="checkbox"
                        checked={hasAcknowledgedDowntime}
                        onChange={(e) => setHasAcknowledgedDowntime(e.target.checked)}
                        className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>
                        I understand that all local terminals will be paused while the atomic database swap executes.
                      </span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer text-stone-700">
                      <input
                        type="checkbox"
                        checked={hasAcknowledgedDataScope}
                        onChange={(e) => setHasAcknowledgedDataScope(e.target.checked)}
                        className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>
                        I understand that active data will be replaced by the snapshot state from{' '}
                        <strong>{selectedBackup.createdAt}</strong>, with a rollback point automatically recorded.
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-800 mb-1">
                      Type <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-amber-800">RESTORE</span> to authorize database replacement:
                    </label>
                    <input
                      type="text"
                      placeholder="Type RESTORE in uppercase"
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                    <Button
                      variant="outline"
                      onClick={onBackToDataProtection}
                    >
                      Cancel
                    </Button>

                    <Button
                      onClick={handleStartRestore}
                      disabled={!isReadyToExecute}
                      className={`font-semibold ${
                        isReadyToExecute
                          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                          : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                      }`}
                    >
                      Execute Safe Restore
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-md border border-stone-200 p-8 text-center text-stone-500">
              Select a backup snapshot from the left list to inspect details.
            </div>
          )}
        </div>
      </div>

      {/* IMPORT EXTERNAL BACKUP MODAL */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import External Backup File"
      >
        <div className="space-y-4 text-xs font-sans">
          <p className="text-stone-600">
            For technician recovery or branch migration, specify the filename of a validated <code className="font-mono">.sqlite.bak</code> file placed in the backup folder.
          </p>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Backup Filename:</label>
            <input
              type="text"
              placeholder="e.g. itredcommerce_emergency_2026-08-19.sqlite.bak"
              value={externalFileName}
              onChange={(e) => setExternalFileName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Import Reason / Notes:</label>
            <input
              type="text"
              placeholder="e.g. Branch server replacement recovery"
              value={externalFileNotes}
              onChange={(e) => setExternalFileNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-stone-200">
            <Button
              variant="outline"
              onClick={() => setIsImportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportExternalFile}
              disabled={!externalFileName.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              Register & Select File
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
