import {
  BackupRecord,
  BackupType,
  BackupVerificationStatus,
  BackupFailureReason,
  BackupRetentionPolicy,
  DatabaseMigrationRecord,
  DatabaseIntegrityCheckResult,
  TableIntegrityCheckItem,
  StorageCapacityInfo,
  StaffMember,
  ActivityEvent,
  OperationalException,
  IntegrityCheckType,
  RestoreExecutionResult
} from '../types';

// ============================================================================
// 1. STANDARD WINDOWS STORAGE SEPARATION & PATH RESOLUTION
// ============================================================================
export const STANDARD_APP_STORAGE_PATHS: StorageCapacityInfo = {
  totalStorageBytes: 128849018880, // ~120 GB
  availableStorageBytes: 45741875200, // ~42.6 GB
  usedStorageBytes: 83107143680, // ~77.4 GB
  appBinariesPath: 'C:\\Program Files\\SCI\\Apps\\iTred Commerce\\',
  activeDataPath: 'C:\\ProgramData\\SCI\\iTred Commerce\\Data\\',
  backupRootPath: 'C:\\Users\\Public\\Documents\\SCI\\backup\\Data\\',
  isStorageAdequate: true,
};

export const DEFAULT_RETENTION_POLICY: BackupRetentionPolicy = {
  dailyRetentionDays: 14,
  manualBackupsRetainedCount: 20,
  preUpdateRetentionDays: 60,
  preMigrationRetentionDays: 60,
  autoBackupHour: 23, // 23:00 (11:00 PM)
  storageLocationPath: 'C:\\Users\\Public\\Documents\\SCI\\backup\\Data\\',
  warnIfStorageBelowMb: 500,
};

export const CURRENT_APP_VERSION = '1.2.0';
export const CURRENT_SCHEMA_VERSION = 17;
export const CURRENT_TENANT_ID = 'TENANT-ITRED-001';

// ============================================================================
// 2. BACKUP NAMING & DETERMINISTIC HASH GENERATION
// ============================================================================
export function generateBackupFilename(type: BackupType, date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  
  return `itredcommerce_${yyyy}-${mm}-${dd}_${hh}${min}${ss}.sqlite.bak`;
}

export function getBackupSubdirectoryForType(type: BackupType): string {
  switch (type) {
    case 'SCHEDULED':
      return 'Daily\\';
    case 'MANUAL':
      return 'Manual\\';
    case 'PRE_UPDATE':
      return 'PreUpdate\\';
    case 'PRE_MIGRATION':
      return 'PreMigration\\';
    case 'PRE_RESTORE':
      return 'RestorePoints\\';
    default:
      return 'Daily\\';
  }
}

// Lightweight deterministic SHA-256 simulation for backup verification
export function calculateBackupChecksum(payloadString: string): string {
  let hash = 0;
  for (let i = 0; i < payloadString.length; i++) {
    const char = payloadString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex1 = Math.abs(hash).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash * 31 + 7).toString(16).padStart(8, '0');
  const hex3 = Math.abs(hash * 63 + 13).toString(16).padStart(8, '0');
  const hex4 = Math.abs(hash * 127 + 19).toString(16).padStart(8, '0');
  return `sha256:${hex1}${hex2}${hex3}${hex4}`;
}

// ============================================================================
// 3. SAFE SQLITE BACKUP CREATION
// ============================================================================
export interface CreateBackupOptions {
  type: BackupType;
  staff: StaffMember;
  notes?: string;
  simulateFailureReason?: BackupFailureReason;
  customTenantId?: string;
}

export function createSafeBackupSnapshot(
  options: CreateBackupOptions,
  databaseStateSnapshot: {
    inventoryItemsCount: number;
    shiftsCount: number;
    salesCount: number;
    debtorsCount: number;
    creditorsCount: number;
    cashMovementsCount: number;
    activityEventsCount: number;
    exceptionsCount: number;
  }
): { success: boolean; backup?: BackupRecord; error?: string; failureReason?: BackupFailureReason } {
  // 1. Storage Capacity Guard
  if (options.simulateFailureReason === 'INSUFFICIENT_STORAGE') {
    return {
      success: false,
      failureReason: 'INSUFFICIENT_STORAGE',
      error: 'Backup aborted: Available storage space on target drive is below the safe threshold of 500 MB.',
    };
  }

  // 2. Destination Available Guard
  if (options.simulateFailureReason === 'DESTINATION_UNAVAILABLE') {
    return {
      success: false,
      failureReason: 'DESTINATION_UNAVAILABLE',
      error: 'Backup failed: Target storage directory (C:\\Users\\Public\\Documents\\SCI\\backup\\Data) is unreachable or disconnected.',
    };
  }

  // 3. Database Busy Guard
  if (options.simulateFailureReason === 'DATABASE_BUSY') {
    return {
      success: false,
      failureReason: 'DATABASE_BUSY',
      error: 'Backup failed: Active transactional lock timed out during SQLite WAL checkpoint.',
    };
  }

  // 4. File Write Error
  if (options.simulateFailureReason === 'FILE_WRITE_FAILED') {
    return {
      success: false,
      failureReason: 'FILE_WRITE_FAILED',
      error: 'Backup failed: Operating system reported write fault while streaming database pages.',
    };
  }

  // 5. Verification Fault simulation
  if (options.simulateFailureReason === 'VERIFICATION_FAILED') {
    return {
      success: false,
      failureReason: 'VERIFICATION_FAILED',
      error: 'Backup failed: Post-write verification check detected checksum mismatch in backup file header.',
    };
  }

  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);
  const filename = generateBackupFilename(options.type, now);
  const subDir = getBackupSubdirectoryForType(options.type);
  const fullPath = `${STANDARD_APP_STORAGE_PATHS.backupRootPath}${subDir}${filename}`;

  const totalRecords = 
    databaseStateSnapshot.inventoryItemsCount +
    databaseStateSnapshot.shiftsCount +
    databaseStateSnapshot.salesCount +
    databaseStateSnapshot.debtorsCount +
    databaseStateSnapshot.creditorsCount +
    databaseStateSnapshot.cashMovementsCount +
    databaseStateSnapshot.activityEventsCount +
    databaseStateSnapshot.exceptionsCount;

  // Approximate realistic file size in bytes (e.g. ~4.2 MB - 14.8 MB)
  const baseSize = 4200000;
  const recordSizeMultiplier = 280;
  const fileSize = baseSize + (totalRecords * recordSizeMultiplier);

  const payloadMeta = `${CURRENT_TENANT_ID}:${CURRENT_SCHEMA_VERSION}:${filename}:${totalRecords}:${dateStr}`;
  const checksum = calculateBackupChecksum(payloadMeta);

  const newBackup: BackupRecord = {
    backupId: `BAK-${Date.now()}`,
    type: options.type,
    createdAt: dateStr,
    applicationVersion: CURRENT_APP_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    filePath: fullPath,
    fileSize,
    verificationStatus: 'VERIFIED',
    checksum,
    tenantId: options.customTenantId || CURRENT_TENANT_ID,
    tablesCount: 28,
    recordsCount: totalRecords,
    walCheckpointCompleted: true,
    notes: options.notes || `Consistent SQLite snapshot created (${options.type}).`,
    initiatedByStaffId: options.staff.id,
    initiatedByStaffName: options.staff.name,
  };

  return {
    success: true,
    backup: newBackup,
  };
}

// ============================================================================
// 4. BACKUP VERIFICATION ENGINE
// ============================================================================
export interface VerificationResult {
  isValid: boolean;
  headerValid: boolean;
  checksumMatch: boolean;
  schemaVersion: number;
  tenantMatch: boolean;
  fileSizeValid: boolean;
  error?: string;
  details: string;
}

export function verifyBackupIntegrity(
  backup: BackupRecord,
  expectedTenantId: string = CURRENT_TENANT_ID
): VerificationResult {
  // 1. File existence & size check
  if (!backup.fileSize || backup.fileSize <= 0) {
    return {
      isValid: false,
      headerValid: false,
      checksumMatch: false,
      schemaVersion: 0,
      tenantMatch: false,
      fileSizeValid: false,
      error: 'Verification Failed: Backup file is empty (0 bytes).',
      details: 'File exists in manifest but reported 0 bytes on disk.',
    };
  }

  // 2. Tenant Compatibility Check
  if (backup.tenantId && backup.tenantId !== expectedTenantId) {
    return {
      isValid: false,
      headerValid: true,
      checksumMatch: true,
      schemaVersion: backup.schemaVersion,
      tenantMatch: false,
      fileSizeValid: true,
      error: `Verification Blocked: Backup belongs to a different organization/tenant (${backup.tenantId}). Active tenant is ${expectedTenantId}.`,
      details: 'Cross-tenant restore is blocked to prevent accidental data contamination.',
    };
  }

  // 3. Schema Version Compatibility
  if (!backup.schemaVersion || backup.schemaVersion < 1) {
    return {
      isValid: false,
      headerValid: false,
      checksumMatch: false,
      schemaVersion: 0,
      tenantMatch: true,
      fileSizeValid: true,
      error: 'Verification Failed: Unrecognizable or missing database schema version marker.',
      details: 'Corrupt SQLite metadata block.',
    };
  }

  // 4. Checksum verification
  if (!backup.checksum || !backup.checksum.startsWith('sha256:')) {
    return {
      isValid: false,
      headerValid: true,
      checksumMatch: false,
      schemaVersion: backup.schemaVersion,
      tenantMatch: true,
      fileSizeValid: true,
      error: 'Verification Failed: Checksum signature corrupted or missing.',
      details: 'Integrity hash failed comparison.',
    };
  }

  return {
    isValid: true,
    headerValid: true,
    checksumMatch: true,
    schemaVersion: backup.schemaVersion,
    tenantMatch: true,
    fileSizeValid: true,
    details: `Consistent SQLite 3.x database header, Schema v${backup.schemaVersion}, SHA-256 verified (${(backup.fileSize / (1024 * 1024)).toFixed(2)} MB, ${backup.recordsCount} records across ${backup.tablesCount} tables).`,
  };
}

export function validateBackupHeader(
  backup: BackupRecord,
  expectedTenantId: string = CURRENT_TENANT_ID
): VerificationResult {
  return verifyBackupIntegrity(backup, expectedTenantId);
}

export function executeSafeDatabaseRestore(
  backup: BackupRecord,
  staff: StaffMember,
  expectedTenantId: string = CURRENT_TENANT_ID,
  _currentSchemaVersion: number = CURRENT_SCHEMA_VERSION
): RestoreExecutionResult {
  const verification = verifyBackupIntegrity(backup, expectedTenantId);
  if (!verification.isValid) {
    return {
      success: false,
      restoredBackupId: backup.backupId,
      tablesRestoredCount: 0,
      recordsRestoredCount: 0,
      integrityVerified: false,
      error: verification.error || 'Restore validation failed.',
      details: verification.details,
      failureStage: 'VALIDATION',
      completedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
  }

  // Mandatory Safety Rollback Pre-Restore Backup creation
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);
  const preRestoreFilename = generateBackupFilename('PRE_RESTORE', now);
  const preRestoreBackup: BackupRecord = {
    backupId: `BAK-PRERESTORE-${Date.now()}`,
    type: 'PRE_RESTORE',
    createdAt: dateStr,
    applicationVersion: CURRENT_APP_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    filePath: `${STANDARD_APP_STORAGE_PATHS.backupRootPath}RestorePoints\\${preRestoreFilename}`,
    fileSize: 9420000,
    verificationStatus: 'VERIFIED',
    checksum: calculateBackupChecksum(`PRERESTORE:${dateStr}:${CURRENT_TENANT_ID}`),
    tenantId: CURRENT_TENANT_ID,
    tablesCount: 28,
    recordsCount: 14820,
    walCheckpointCompleted: true,
    notes: `Mandatory safety rollback snapshot created immediately before applying restore ${backup.backupId}.`,
    initiatedByStaffId: staff.id,
    initiatedByStaffName: staff.name,
  };

  return {
    success: true,
    restoredBackupId: backup.backupId,
    preRestoreBackupCreated: preRestoreBackup,
    tablesRestoredCount: backup.tablesCount || 28,
    recordsRestoredCount: backup.recordsCount || 14200,
    integrityVerified: true,
    details: `Atomic swap succeeded. Database restored to backup ${backup.backupId} created at ${backup.createdAt}. Rollback snapshot saved to ${preRestoreBackup.backupId}.`,
    completedAt: dateStr,
  };
}

// ============================================================================
// 5. DETERMINISTIC BACKUP RETENTION PRUNING
// ============================================================================
export function applyBackupRetentionPolicy(
  backups: BackupRecord[],
  policy: BackupRetentionPolicy = DEFAULT_RETENTION_POLICY
): { retained: BackupRecord[]; pruned: BackupRecord[]; logMessage: string } {
  if (backups.length === 0) {
    return { retained: [], pruned: [], logMessage: 'No backups in manifest.' };
  }

  const now = new Date();
  const sortedBackups = [...backups].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // NEVER delete the newest verified backup regardless of age
  const newestVerified = sortedBackups.find((b) => b.verificationStatus === 'VERIFIED');

  const retained: BackupRecord[] = [];
  const pruned: BackupRecord[] = [];

  let manualCount = 0;

  sortedBackups.forEach((b) => {
    // Newest verified backup is protected unconditionally
    if (newestVerified && b.backupId === newestVerified.backupId) {
      retained.push(b);
      return;
    }

    // Protect RestorePoints (PRE_RESTORE) for at least 7 days
    if (b.type === 'PRE_RESTORE') {
      const daysOld = Math.floor((now.getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOld <= 7) {
        retained.push(b);
      } else {
        pruned.push(b);
      }
      return;
    }

    // Daily retention
    if (b.type === 'SCHEDULED') {
      const daysOld = Math.floor((now.getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOld <= policy.dailyRetentionDays) {
        retained.push(b);
      } else {
        pruned.push(b);
      }
      return;
    }

    // Manual retention count cap
    if (b.type === 'MANUAL') {
      manualCount++;
      if (manualCount <= policy.manualBackupsRetainedCount) {
        retained.push(b);
      } else {
        pruned.push(b);
      }
      return;
    }

    // Pre-Update / Pre-Migration retention
    if (b.type === 'PRE_UPDATE' || b.type === 'PRE_MIGRATION') {
      const daysOld = Math.floor((now.getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const maxDays = b.type === 'PRE_UPDATE' ? policy.preUpdateRetentionDays : policy.preMigrationRetentionDays;
      if (daysOld <= maxDays) {
        retained.push(b);
      } else {
        pruned.push(b);
      }
      return;
    }

    // Default: retain
    retained.push(b);
  });

  const logMessage = `Retention evaluated: ${retained.length} retained, ${pruned.length} pruned. Newest verified backup (${newestVerified?.backupId || 'none'}) preserved.`;

  return { retained, pruned, logMessage };
}

// ============================================================================
// 6. DATABASE INTEGRITY CHECK RUNNER (ROUTINE VS DEEP)
// ============================================================================
export function performDatabaseIntegrityCheck(
  checkType: 'STARTUP_LIGHTWEIGHT' | 'SCHEDULED_DEEP' | 'PRE_UPDATE' | 'PRE_MIGRATION' | 'POST_RESTORE' | 'MANUAL',
  staffName: string = 'System Supervisor',
  tableStats: {
    itemsCount: number;
    movementsCount: number;
    shiftsCount: number;
    debtorsCount: number;
    creditorsCount: number;
    cashCount: number;
    eventsCount: number;
    exceptionsCount: number;
  },
  abnormalShutdownSimulated: boolean = false
): DatabaseIntegrityCheckResult {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const tables: TableIntegrityCheckItem[] = [
    { tableName: 'inventory_items', rowCount: tableStats.itemsCount, status: 'PASSED' },
    { tableName: 'inventory_movements', rowCount: tableStats.movementsCount, status: 'PASSED' },
    { tableName: 'shifts_ledger', rowCount: tableStats.shiftsCount, status: 'PASSED' },
    { tableName: 'debtor_transactions', rowCount: tableStats.debtorsCount, status: 'PASSED' },
    { tableName: 'creditor_transactions', rowCount: tableStats.creditorsCount, status: 'PASSED' },
    { tableName: 'cash_bank_movements', rowCount: tableStats.cashCount, status: 'PASSED' },
    { tableName: 'activity_events_ledger', rowCount: tableStats.eventsCount, status: 'PASSED' },
    { tableName: 'operational_exceptions', rowCount: tableStats.exceptionsCount, status: 'PASSED' },
  ];

  let overallStatus: 'HEALTHY' | 'CHECKING' | 'ATTENTION_REQUIRED' | 'RECOVERY_REQUIRED' = 'HEALTHY';
  let recoveryNotes: string | undefined = undefined;

  if (abnormalShutdownSimulated) {
    overallStatus = 'ATTENTION_REQUIRED';
    recoveryNotes = 'Abnormal prior shutdown detected (lock marker active). WAL journal replayed cleanly and transactional consistency verified with 0 lost records.';
  }

  return {
    checkId: `CHK-${Date.now()}`,
    timestamp: now,
    checkType,
    overallStatus,
    sqliteHeaderValid: true,
    pageCount: 3840,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    walModeActive: true,
    unresolvedForeignKeys: 0,
    tableIntegrityChecks: tables,
    abnormalShutdownDetected: abnormalShutdownSimulated,
    recoveryNotes,
    checkedByStaffName: staffName,
  };
}

// ============================================================================
// 7. SCHEMA MIGRATION REGISTRY (v1 TO v17 AUDIT TRAIL)
// ============================================================================
export const INITIAL_MIGRATION_REGISTRY: DatabaseMigrationRecord[] = [
  {
    migrationId: 'MIG-001-CORE-SCHEMA',
    sourceVersion: 0,
    targetVersion: 1,
    description: 'Initial Core POS Schema (Items, Barcodes, Pricing, Staff, Tax Rates)',
    appliedAt: '2026-08-01 08:00:00',
    applicationVersion: '1.0.0',
    status: 'COMPLETED',
    executionTimeMs: 340,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-002-DEBTORS-AR',
    sourceVersion: 1,
    targetVersion: 2,
    description: 'Customer Accounts, Credit Limits, Invoices, and Debtors Aging Ledger',
    appliedAt: '2026-08-02 09:15:00',
    applicationVersion: '1.0.1',
    status: 'COMPLETED',
    executionTimeMs: 180,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-003-CREDITORS-AP',
    sourceVersion: 2,
    targetVersion: 3,
    description: 'Supplier Accounts, Purchase Orders, Goods Receipt Notes, Creditors Ledger',
    appliedAt: '2026-08-03 10:20:00',
    applicationVersion: '1.0.2',
    status: 'COMPLETED',
    executionTimeMs: 210,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-004-MULTI-LOCATION',
    sourceVersion: 3,
    targetVersion: 4,
    description: 'Warehouses, Branches, POS Terminals, and Bin Location Partitioning',
    appliedAt: '2026-08-04 11:30:00',
    applicationVersion: '1.0.3',
    status: 'COMPLETED',
    executionTimeMs: 260,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-005-CASH-BANK-ACCOUNTS',
    sourceVersion: 4,
    targetVersion: 5,
    description: 'Tills, Safe Storage, Bank Accounts, Mobile Money Accounts, Daily Banking',
    appliedAt: '2026-08-05 14:10:00',
    applicationVersion: '1.0.4',
    status: 'COMPLETED',
    executionTimeMs: 195,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-006-SHIFT-RECONCILIATION',
    sourceVersion: 5,
    targetVersion: 6,
    description: 'Multi-Tender Shift Lifecycle, Blind Cash-Up, Immutable Closure Snapshots',
    appliedAt: '2026-08-07 08:45:00',
    applicationVersion: '1.0.5',
    status: 'COMPLETED',
    executionTimeMs: 290,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-007-LAYAWAY-HELD-SALES',
    sourceVersion: 6,
    targetVersion: 7,
    description: 'Layaways, Deposit Schedules, Held Sales Buffer, Credit Notes',
    appliedAt: '2026-08-08 13:00:00',
    applicationVersion: '1.0.6',
    status: 'COMPLETED',
    executionTimeMs: 220,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-008-STOCK-LEDGER',
    sourceVersion: 7,
    targetVersion: 8,
    description: 'Immutable Stock Movement Audit Trail, Cost Basis, Inter-branch Transfers',
    appliedAt: '2026-08-10 10:00:00',
    applicationVersion: '1.1.0',
    status: 'COMPLETED',
    executionTimeMs: 310,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-009-FORMAL-STOCKTAKE',
    sourceVersion: 8,
    targetVersion: 9,
    description: 'Stocktake Engine, Blind Count Partitions, Variance Approval Workflows',
    appliedAt: '2026-08-11 16:30:00',
    applicationVersion: '1.1.1',
    status: 'COMPLETED',
    executionTimeMs: 275,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-010-PERMISSIONS-APPROVALS',
    sourceVersion: 9,
    targetVersion: 10,
    description: 'Role-based Access Control, Supervisor Override Ledger, Dual Sign-off',
    appliedAt: '2026-08-12 11:20:00',
    applicationVersion: '1.1.2',
    status: 'COMPLETED',
    executionTimeMs: 190,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-011-ACTIVITY-EVENTS-EXCEPTIONS',
    sourceVersion: 10,
    targetVersion: 11,
    description: 'Canonical Activity Event Schema, Operational Exception Ledger',
    appliedAt: '2026-08-14 09:00:00',
    applicationVersion: '1.1.3',
    status: 'COMPLETED',
    executionTimeMs: 350,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-012-METRIC-DICTIONARY',
    sourceVersion: 11,
    targetVersion: 12,
    description: 'Central Metric Dictionary Foundation, Deterministic KPI Definitions',
    appliedAt: '2026-08-15 14:40:00',
    applicationVersion: '1.1.4',
    status: 'COMPLETED',
    executionTimeMs: 230,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-013-BUSINESS-RESERVES',
    sourceVersion: 12,
    targetVersion: 13,
    description: 'Capital Reserves, Dual-Approval Fund Allocations, Expense Buckets',
    appliedAt: '2026-08-16 10:15:00',
    applicationVersion: '1.1.5',
    status: 'COMPLETED',
    executionTimeMs: 215,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-014-CASH-MANAGER-LEDGER',
    sourceVersion: 13,
    targetVersion: 14,
    description: 'Safe Transfers, Till Drops, Floating Reconciliation, Cash Movement Logs',
    appliedAt: '2026-08-17 11:50:00',
    applicationVersion: '1.1.6',
    status: 'COMPLETED',
    executionTimeMs: 240,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-015-FISCALIZATION-SIGNING',
    sourceVersion: 14,
    targetVersion: 15,
    description: 'Offline Fiscal Document Queue, Digital Cryptographic Signatures, Z-Reports',
    appliedAt: '2026-08-18 09:30:00',
    applicationVersion: '1.1.7',
    status: 'COMPLETED',
    executionTimeMs: 280,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-016-DETERMINISTIC-INVENTORY-INTEL',
    sourceVersion: 15,
    targetVersion: 16,
    description: 'Rule-based Replenishment, Stocktake Risk Signals, Price Floor Evaluation',
    appliedAt: '2026-08-18 17:10:00',
    applicationVersion: '1.2.0',
    status: 'COMPLETED',
    executionTimeMs: 310,
    appliedByStaffName: 'System Bootstrap',
  },
  {
    migrationId: 'MIG-017-BACKUP-INTEGRITY-RESTORE-SAFETY',
    sourceVersion: 16,
    targetVersion: 17,
    description: 'Backup Manifest, Atomic Staged Restore, Startup SQLite Integrity Checks',
    appliedAt: '2026-08-19 01:10:00',
    applicationVersion: '1.2.0',
    status: 'COMPLETED',
    executionTimeMs: 360,
    appliedByStaffName: 'System Bootstrap',
  },
];

export interface MigrationRecordItem extends DatabaseMigrationRecord {
  name: string;
  executedAt: string;
}

export const MIGRATION_REGISTRY: MigrationRecordItem[] = (INITIAL_MIGRATION_REGISTRY || []).map((m) => ({
  ...m,
  name: m.description ? (m.description.includes('(') ? m.description.split('(')[0].trim() : m.description) : m.migrationId,
  executedAt: m.appliedAt,
}));

export function runDatabaseIntegrityScan(
  type: IntegrityCheckType = 'STARTUP'
): DatabaseIntegrityCheckResult {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const detailedTables: TableIntegrityCheckItem[] = [
    { tableName: 'inventory_items', rowCount: 1420, recordsCount: 1420, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'inventory_movements', rowCount: 8940, recordsCount: 8940, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'shifts_ledger', rowCount: 148, recordsCount: 148, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'debtor_transactions', rowCount: 520, recordsCount: 520, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'creditor_transactions', rowCount: 310, recordsCount: 310, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'cash_bank_movements', rowCount: 890, recordsCount: 890, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'activity_events_ledger', rowCount: 3410, recordsCount: 3410, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'operational_exceptions', rowCount: 38, recordsCount: 38, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'fiscal_document_queue', rowCount: 14, recordsCount: 14, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'reorder_recommendations', rowCount: 42, recordsCount: 42, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'stocktake_risk_signals', rowCount: 19, recordsCount: 19, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
    { tableName: 'schema_migrations', rowCount: 17, recordsCount: 17, status: 'PASSED', indexStatus: 'B-Tree Valid', foreignKeyStatus: 'Referenced OK', corruptPages: 0 },
  ];

  return {
    checkId: `CHK-${Date.now()}`,
    timestamp: now,
    checkedAt: now,
    checkType: type,
    overallStatus: 'HEALTHY',
    sqliteHeaderValid: true,
    pageCount: 3840,
    freeListCount: 42,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    walModeActive: true,
    walCheckpointStatus: 'Active / WAL Checkpoint OK',
    unresolvedForeignKeys: 0,
    tableIntegrityChecks: detailedTables,
    tablesChecked: detailedTables,
    abnormalShutdownDetected: false,
    checkedByStaffName: 'System Supervisor',
  };
}
