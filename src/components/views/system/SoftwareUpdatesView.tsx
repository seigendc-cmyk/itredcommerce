import React, { useState } from 'react';
import { 
  DownloadCloud, 
  RefreshCw, 
  ArrowLeft, 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  WifiOff, 
  Wifi, 
  Clock, 
  HardDrive, 
  Layers, 
  Info,
  Sliders,
  Sparkles,
  Archive,
  Cpu
} from 'lucide-react';
import { SoftwareUpdateInfo, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Alert } from '../../ui/Alert';
import { Modal } from '../../ui/Modal';

interface SoftwareUpdatesViewProps {
  updateInfo: SoftwareUpdateInfo;
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onUpdateSoftwareInfo: (updated: SoftwareUpdateInfo) => void;
}

export const SoftwareUpdatesView: React.FC<SoftwareUpdatesViewProps> = ({
  updateInfo,
  currentStaff,
  onBackToLanding,
  onUpdateSoftwareInfo,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(updateInfo.isOffline);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isBackupDetailsOpen, setIsBackupDetailsOpen] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  const handleCheckForUpdates = () => {
    setIsChecking(true);
    setNoticeMessage(null);

    setTimeout(() => {
      setIsChecking(false);
      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

      if (isSimulatedOffline) {
        const updated: SoftwareUpdateInfo = {
          ...updateInfo,
          lastChecked: `${timestamp} (Network Unreachable)`,
          updateStatus: 'OFFLINE_UNAVAILABLE',
          isOffline: true,
        };
        onUpdateSoftwareInfo(updated);
        setNoticeMessage('Internet connection required to check for updates. Normal offline POS operations are unaffected.');
      } else {
        const updated: SoftwareUpdateInfo = {
          ...updateInfo,
          lastChecked: `${timestamp} (Live Cloud Server Verified)`,
          updateStatus: 'UPDATE_AVAILABLE',
          isOffline: false,
        };
        onUpdateSoftwareInfo(updated);
        setNoticeMessage('Update check completed: New version v3.5.0-LTS is available for download.');
      }
    }, 1200);
  };

  const handleApplyUpdate = () => {
    setIsApplyingUpdate(true);
    setUpdateProgress(15);

    setTimeout(() => setUpdateProgress(40), 600);
    setTimeout(() => setUpdateProgress(75), 1200);
    setTimeout(() => {
      setUpdateProgress(100);
      setTimeout(() => {
        setIsApplyingUpdate(false);
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const updated: SoftwareUpdateInfo = {
          ...updateInfo,
          currentVersion: 'v3.5.0-build.8910',
          updateStatus: 'UP_TO_DATE',
          lastChecked: `${timestamp} (Updated to latest build)`,
          lastAutomaticBackupSnapshot: `${timestamp} (Pre-Update Snapshot Created)`,
        };
        onUpdateSoftwareInfo(updated);
        setNoticeMessage('Software updated successfully! Database migrations applied cleanly from automated snapshot.');
      }, 500);
    }, 1800);
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
              <DownloadCloud className="w-4 h-4 text-orange-400" />
              Software Updates & Maintenance Engine
            </h1>
            <p className="text-[10px] font-mono text-slate-400">
              Version Diagnostics, Pre-Flight Database Snapshots, Offline Safety & Release Feeds
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSimulatedOffline(!isSimulatedOffline)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 transition ${
              isSimulatedOffline
                ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
                : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700'
            }`}
            title="Toggle simulated network state for testing update check behavior"
          >
            {isSimulatedOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                Mode: Offline (Isolated)
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5" />
                Mode: Online (Connected)
              </>
            )}
          </button>

          <Button
            size="sm"
            variant="primary"
            onClick={handleCheckForUpdates}
            isLoading={isChecking}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Check for Updates
          </Button>
        </div>
      </div>

      {/* Offline Notice Banner */}
      {isSimulatedOffline && (
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded flex items-start gap-3 text-amber-900 shadow-xs">
          <WifiOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-amber-950">
              Internet connection required to check for updates.
            </div>
            <div className="text-amber-800 text-[11px] leading-relaxed">
              Your workstation is currently offline. All local point-of-sale registers, receipt printing, held carts, and stock management continue operating with 100% independence. Update checks will resume automatically when connectivity is restored.
            </div>
          </div>
        </div>
      )}

      {noticeMessage && !isSimulatedOffline && (
        <Alert variant="info" title="System Notice">
          {noticeMessage}
        </Alert>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Version Card & Release Notes */}
        <div className="lg:col-span-2 space-y-4">
          {/* Current Version Card */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-orange-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Installed Application Build & Diagnostics
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                Channel: {updateInfo.releaseChannel}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Current Version
                </div>
                <div className="text-sm font-mono font-bold text-slate-900">
                  {updateInfo.currentVersion}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Update Status
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {updateInfo.updateStatus === 'UP_TO_DATE' && (
                    <StatusBadge status="ACTIVE" customLabel="UP TO DATE" />
                  )}
                  {updateInfo.updateStatus === 'UPDATE_AVAILABLE' && (
                    <StatusBadge status="PENDING" customLabel="UPDATE AVAILABLE" />
                  )}
                  {updateInfo.updateStatus === 'OFFLINE_UNAVAILABLE' && (
                    <StatusBadge status="VOIDED" customLabel="OFFLINE UNAVAILABLE" />
                  )}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Last Checked
                </div>
                <div className="text-[11px] font-mono text-slate-700 truncate" title={updateInfo.lastChecked}>
                  {updateInfo.lastChecked}
                </div>
              </div>
            </div>

            {/* If update available */}
            {updateInfo.updateStatus === 'UPDATE_AVAILABLE' && updateInfo.availableVersion && (
              <div className="bg-orange-50 border border-orange-200 p-3.5 rounded space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                    <div>
                      <div className="text-xs font-bold text-orange-950">
                        New Release Available: {updateInfo.availableVersion}
                      </div>
                      <div className="text-[10px] text-orange-800 font-mono">
                        Download Size: {updateInfo.downloadSizeMb} MB • Minimum Schema: {updateInfo.minimumSchemaVersionRequired}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleApplyUpdate}
                    isLoading={isApplyingUpdate}
                    leftIcon={<DownloadCloud className="w-4 h-4" />}
                  >
                    Install Update with Safety Snapshot
                  </Button>
                </div>

                {isApplyingUpdate && (
                  <div className="space-y-1.5 pt-2 border-t border-orange-200">
                    <div className="flex justify-between text-[11px] font-mono text-orange-900">
                      <span>Applying Update & Executing Pre-Flight Database Backup...</span>
                      <span>{updateProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-orange-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-600 transition-all duration-300"
                        style={{ width: `${updateProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Release Notes */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              Changelog & Architecture Improvements
            </h3>

            <div className="space-y-2">
              {updateInfo.releaseNotes?.map((note, index) => (
                <div key={index} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Safety & Snapshot Enforcements */}
        <div className="space-y-4">
          {/* Automated Backup Snapshot Guarantee Card */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Pre-Update Database Snapshot Guarantee
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The updater creates an automated, verified database backup snapshot before applying schema migrations or binaries to prevent data corruption.
            </p>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded space-y-1.5 text-xs text-emerald-900">
              <div className="flex items-center justify-between font-bold text-[11px]">
                <span>Automatic Snapshot:</span>
                <span className="text-emerald-700 font-mono">ENFORCED</span>
              </div>
              <div className="text-[10px] font-mono text-emerald-800">
                Last Verified: {updateInfo.lastAutomaticBackupSnapshot || '2026-08-15 12:00 (Pre-Flight OK)'}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBackupDetailsOpen(true)}
              leftIcon={<Archive className="w-3.5 h-3.5" />}
              className="w-full justify-center text-slate-700"
            >
              Inspect Backup Safeguards
            </Button>
          </div>

          {/* Update Channel Preferences */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              Release Channel Configuration
            </h3>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="releaseChannel"
                  checked={updateInfo.releaseChannel === 'STABLE_LTS'}
                  onChange={() => onUpdateSoftwareInfo({ ...updateInfo, releaseChannel: 'STABLE_LTS' })}
                  className="text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <div className="font-bold text-slate-800">Stable Long-Term Support (LTS)</div>
                  <div className="text-[10px] text-slate-500">Recommended for production POS workstations.</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="releaseChannel"
                  checked={updateInfo.releaseChannel === 'MONTHLY_RELEASE'}
                  onChange={() => onUpdateSoftwareInfo({ ...updateInfo, releaseChannel: 'MONTHLY_RELEASE' })}
                  className="text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <div className="font-bold text-slate-800">Monthly Feature Rollout</div>
                  <div className="text-[10px] text-slate-500">Early access to newly released peripheral drivers.</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Backup Safeguards Inspection */}
      <Modal
        isOpen={isBackupDetailsOpen}
        onClose={() => setIsBackupDetailsOpen(false)}
        title="Automated Pre-Flight Backup Snapshot Engine"
        size="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-900 text-slate-200 rounded font-mono text-[11px] space-y-1">
            <div className="text-emerald-400 font-bold">--- PRE-UPDATE SNAPSHOT MANIFEST ---</div>
            <div>Database Engine: SQLite 3.42 (WAL Mode)</div>
            <div>Snapshot Location: C:\iTredCommerce\Backups\pre_update_snap.db</div>
            <div>Integrity Check: PRAGMA integrity_check = OK</div>
            <div>Rollback Script: Standalone CLI Rollback Executable Attached</div>
          </div>

          <p className="text-slate-600 leading-relaxed">
            In the event of an unexpected power failure or schema mismatch during updates, the local application supervisor automatically aborts binary replacement and restores the verified pre-flight snapshot.
          </p>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBackupDetailsOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
