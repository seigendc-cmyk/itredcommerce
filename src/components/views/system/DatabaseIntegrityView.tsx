import React, { useState } from 'react';
import { 
  Database, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  Layers, 
  Activity, 
  HardDrive, 
  FileCode, 
  Clock, 
  RotateCcw,
  Sparkles,
  Info,
  Check
} from 'lucide-react';
import { 
  DatabaseMigrationRecord, 
  DatabaseIntegrityCheckResult, 
  StaffMember, 
  ActivityEvent,
  IntegrityCheckType
} from '../../../types';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';
import { StatusBadge } from '../../ui/StatusBadge';
import { 
  CURRENT_APP_VERSION, 
  CURRENT_SCHEMA_VERSION, 
  MIGRATION_REGISTRY, 
  runDatabaseIntegrityScan 
} from '../../../utils/backupRestoreEngine';

interface DatabaseIntegrityViewProps {
  currentStaff: StaffMember;
  onBackToDataProtection: () => void;
  onNavigateToLanding: () => void;
  onEmitActivityEvent: (event: Partial<ActivityEvent>) => void;
}

export const DatabaseIntegrityView: React.FC<DatabaseIntegrityViewProps> = ({
  currentStaff,
  onBackToDataProtection,
  onNavigateToLanding,
  onEmitActivityEvent,
}) => {
  const [activeTab, setActiveTab] = useState<'HEALTH' | 'MIGRATIONS' | 'CRASH_RECOVERY'>('HEALTH');
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState<IntegrityCheckType>('STARTUP');
  const [integrityResult, setIntegrityResult] = useState<DatabaseIntegrityCheckResult>(() =>
    runDatabaseIntegrityScan('STARTUP')
  );

  const handleExecuteScan = (type: IntegrityCheckType) => {
    setScanType(type);
    setIsScanning(true);

    setTimeout(() => {
      const result = runDatabaseIntegrityScan(type);
      setIntegrityResult(result);
      setIsScanning(false);

      onEmitActivityEvent({
        eventType: result.overallStatus === 'HEALTHY' ? 'INTEGRITY_CHECK_COMPLETED' : 'INTEGRITY_CHECK_FAILED',
        description: `SQLite ${type === 'DEEP' ? 'Deep' : 'Startup Quick'} Integrity Check: ${result.overallStatus} (${result.tablesChecked.length} tables verified)`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        outcome: result.overallStatus === 'HEALTHY' ? 'COMPLETED' : 'FAILED',
      });
    }, 800);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 font-sans">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-6 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDataProtection}
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded transition"
            title="Return to Data Protection Center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-stone-800 text-white rounded-md shadow-sm">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              Database Integrity & Migration Registry
            </h1>
            <p className="text-sm text-stone-600">
              Low-level SQLite health verification, table schema diagnostics, and version evolution history.
            </p>
          </div>
        </div>

        {/* Scan Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleExecuteScan('STARTUP')}
            disabled={isScanning}
            className="flex items-center gap-2 border-stone-300 text-stone-700"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning && scanType === 'STARTUP' ? 'animate-spin text-orange-600' : ''}`} />
            <span>Run Quick Scan</span>
          </Button>

          <Button
            onClick={() => handleExecuteScan('DEEP')}
            disabled={isScanning}
            className="flex items-center gap-2 bg-stone-800 hover:bg-stone-900 text-white font-medium shadow-sm"
          >
            <ShieldCheck className={`w-4 h-4 ${isScanning && scanType === 'DEEP' ? 'animate-spin text-orange-400' : ''}`} />
            <span>Run Deep Verification</span>
          </Button>
        </div>
      </div>

      {/* KPI Status Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
        <div className="bg-white p-4 rounded-md border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Overall Health</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {integrityResult.overallStatus}
            </span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-stone-900">
              {integrityResult.tablesChecked.length} Tables Clean
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Checked at {integrityResult?.checkedAt ? (integrityResult.checkedAt.includes(' ') ? integrityResult.checkedAt.split(' ')[1] : integrityResult.checkedAt.includes('T') ? integrityResult.checkedAt.split('T')[1]?.substring(0, 8) : integrityResult.checkedAt) : 'Just now'}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-md border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Schema Version</span>
            <span className="text-xs font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-800">
              v{CURRENT_SCHEMA_VERSION} Latest
            </span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-stone-900">
              17 Ordered Migrations
            </div>
            <p className="text-xs text-stone-500 mt-1">
              App Version: v{CURRENT_APP_VERSION}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-md border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">WAL Journal</span>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
              Synced
            </span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-stone-900">
              {integrityResult.walCheckpointStatus}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Write-Ahead Logging mode enabled
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-md border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">SQLite Page Stats</span>
            <span className="text-xs text-stone-600 font-mono">4096 B / Page</span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-stone-900">
              {integrityResult.pageCount.toLocaleString()} Total Pages
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {integrityResult.freeListCount} Free Pages in Pool
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 mb-6">
        <button
          onClick={() => setActiveTab('HEALTH')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 ${
            activeTab === 'HEALTH'
              ? 'border-stone-800 text-stone-900'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Table Schema Diagnostics ({integrityResult.tablesChecked.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MIGRATIONS')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 ${
            activeTab === 'MIGRATIONS'
              ? 'border-stone-800 text-stone-900'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Migration Registry (v1 - v17)</span>
        </button>

        <button
          onClick={() => setActiveTab('CRASH_RECOVERY')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 ${
            activeTab === 'CRASH_RECOVERY'
              ? 'border-stone-800 text-stone-900'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Abnormal Shutdown & Recovery Architecture</span>
        </button>
      </div>

      {/* TAB 1: TABLE HEALTH DIAGNOSTICS */}
      {activeTab === 'HEALTH' && (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 text-stone-700 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Table Name</th>
                    <th className="py-3 px-4">Record Count</th>
                    <th className="py-3 px-4">Index Integrity</th>
                    <th className="py-3 px-4">Foreign Keys</th>
                    <th className="py-3 px-4">Corrupt Pages</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-sans">
                  {integrityResult.tablesChecked.map((tbl) => (
                    <tr key={tbl.tableName} className="hover:bg-stone-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900 font-mono">{tbl.tableName}</div>
                      </td>
                      <td className="py-3 px-4 text-stone-700 font-medium">
                        {tbl.recordsCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          {tbl.indexStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          {tbl.foreignKeyStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {tbl.corruptPages}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          CLEAN
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MIGRATION REGISTRY (v1 - v17) */}
      {activeTab === 'MIGRATIONS' && (
        <div className="space-y-4">
          <div className="bg-stone-50 p-4 rounded-md border border-stone-200 text-xs text-stone-700 space-y-1">
            <h3 className="font-bold text-stone-900 text-sm">Strict Deterministic Schema Evolution</h3>
            <p>
              Schema migrations are executed sequentially in transaction wrappers. Every migration requires an automated pre-migration backup before changes are applied to the active database.
            </p>
          </div>

          <div className="bg-white rounded-md border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 text-stone-700 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Migration ID</th>
                    <th className="py-3 px-4">Target Version</th>
                    <th className="py-3 px-4">Migration Name & Scope</th>
                    <th className="py-3 px-4">Executed At</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Pre-Backup</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-sans">
                  {MIGRATION_REGISTRY.slice().reverse().map((m) => (
                    <tr key={m.migrationId} className="hover:bg-stone-50 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold text-stone-900">{m.migrationId}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-stone-800">
                          v{m.sourceVersion} &rarr; v{m.targetVersion}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900">{m.name}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5">{m.description}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-stone-600">
                        {m.executedAt}
                      </td>

                      <td className="py-3 px-4 font-mono text-stone-600">
                        {m.executionTimeMs} ms
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-stone-600">
                        {m.preMigrationBackupId ? (
                          <span className="text-indigo-700 font-semibold">{m.preMigrationBackupId}</span>
                        ) : (
                          <span className="text-stone-400">Baseline Init</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          APPLIED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CRASH RECOVERY ARCHITECTURE */}
      {activeTab === 'CRASH_RECOVERY' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-md border border-stone-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900">Abnormal Termination Resilience Rules</h2>
            <div className="space-y-3 text-xs text-stone-600">
              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="font-semibold text-stone-900 block mb-1">1. SQLite WAL Journal Replay</span>
                <p>
                  If the computer suddenly loses power or crashes during an active shift, SQLite automatically recovers on restart by replaying committed WAL frames and discarding uncommitted bytes.
                </p>
              </div>

              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="font-semibold text-stone-900 block mb-1">2. No Silent Record Deletion</span>
                <p>
                  Corrupt or partial events are never silently pruned. If an error is detected, an Operational Exception is logged and presented for supervisor action.
                </p>
              </div>

              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="font-semibold text-stone-900 block mb-1">3. Idempotent Offline Queues</span>
                <p>
                  Sales transactions and activity events carry unique client-generated UUIDs (e.g. `EVT-2026-0819-001`) to guard against duplicate insertion upon re-sync.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md border border-stone-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900">Startup Integrity Invariant Verification</h2>
            <div className="space-y-3 text-xs text-stone-700">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Header Check:</strong> SQLite header string <code className="font-mono text-stone-900">"SQLite format 3\0"</code> is verified before opening database connections.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Foreign Key Enforcement:</strong> <code className="font-mono text-stone-900">PRAGMA foreign_keys = ON</code> ensures all stock movement and shift references remain referentially valid.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Zero Data Loss Guarantee:</strong> No update or schema migration proceeds without an automated pre-flight snapshot.
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-200">
              <Button
                onClick={() => handleExecuteScan('DEEP')}
                className="w-full bg-stone-800 hover:bg-stone-900 text-white font-medium"
              >
                Perform Deep Integrity Scan Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
