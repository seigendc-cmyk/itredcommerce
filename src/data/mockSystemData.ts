import {
  LicenceInfo,
  SoftwareUpdateInfo,
  PosDevice,
  PaymentMethodConfig,
  FiscalConfig
} from '../types';

export const INITIAL_LICENCE_INFO: LicenceInfo = {
  productCode: 'ITRED-DESK-PRO-2026',
  installationId: 'INST-8842-9901-7724-X4K',
  activationCode: 'ITR-PRO-8892-KL99-OFFL-2026',
  productStatus: 'ACTIVE',
  currentPlan: 'PROFESSIONAL_DESKTOP',
  planLabel: 'iTred Commerce Pro — Multi-Register Autonomous Edition',
  entitlements: [
    'Autonomous Offline Operation & Local Database Storage',
    'Up to 5 Local POS Terminal Nodes per Branch',
    'Dual-Currency & Cash Drawer Float Management',
    '14 Rule-Based Local Business Intelligence (BI) Audits',
    '10 Complete Commercial & Tax Audit Reporting Groups',
    'Fiscal Memory ETR & ESD Cryptographic Device Drivers',
    'Debtors & Creditors Sub-Ledgers with Aging Analytics',
    'Barcode Generation, Scanner Wedge & Serial Scales'
  ],
  activationDate: '2026-01-15',
  expiryDate: '2027-01-15',
  lastActivation: '2026-08-01 09:14:22 (Verified Offline Cryptographic Token)',
  activationStatus: 'LICENSED',
  gracePeriodDaysRemaining: 14,
  supportContactWhatsApp: '+254700000000',
  companyName: 'Apex Commercial Supplies Ltd',
  branchRegistered: 'Downtown Main Commercial Branch (BR-01)',
  cryptographicSignatureStatus: 'VALID_OFFLINE_SIGNATURE',
  maxAllowedTerminals: 5
};

export const INITIAL_SOFTWARE_UPDATE_INFO: SoftwareUpdateInfo = {
  currentVersion: 'v3.4.2-build.8824',
  releaseChannel: 'STABLE_LTS',
  lastChecked: '2026-08-15 08:30 (Cached Diagnostic Check)',
  updateStatus: 'UP_TO_DATE',
  isOffline: true,
  availableVersion: 'v3.5.0-LTS (Feature Release)',
  releaseNotes: [
    'Enhanced ESC/POS driver compatibility with 58mm & 80mm thermal receipt printers',
    'Optimized SQLite indexing for inventory searches exceeding 50,000 SKUs',
    'Added automated pre-update backup snapshot engine before schema migrations',
    'Improved offline queue reliability for fiscal document retries and Z-reports',
    'Added WhatsApp quick renewal channel support for local license tokens'
  ],
  downloadSizeMb: 42.8,
  requireDatabaseBackup: true,
  lastAutomaticBackupSnapshot: '2026-08-15 12:00:00 (Pre-Flight Snapshot Verified)',
  minimumSchemaVersionRequired: 'schema-v2026.8'
};

export const INITIAL_POS_DEVICES: PosDevice[] = [
  {
    id: 'DEV-PRN-01',
    name: 'Main Counter Thermal Receipt Printer',
    category: 'RECEIPT_PRINTER',
    connectionType: 'USB_RAW',
    portOrAddress: 'USB001 (VID:04B8 PID:0202 - Epson TM-T88VI)',
    modelManufacturer: 'Epson / Generic ESC/POS 80mm High-Speed',
    status: 'CONNECTED',
    isDefault: true,
    lastTestedAt: '2026-08-15 08:05:12',
    lastTestResult: 'Handshake OK — Test Slip Printed (80mm / Full Cut)',
    configParams: {
      paperWidthMm: 80,
      autoCut: true,
      drawerPin: 2,
      pulseMs: 100,
      timeoutMs: 3000
    }
  },
  {
    id: 'DEV-SCN-01',
    name: 'Front Register 2D Presentation Scanner',
    category: 'BARCODE_SCANNER',
    connectionType: 'USB_RAW',
    portOrAddress: 'HID Keyboard Wedge (Standard POS Mode)',
    modelManufacturer: 'Honeywell Genesis / Zebra DS9308 2D Imager',
    status: 'CONNECTED',
    isDefault: true,
    lastTestedAt: '2026-08-15 08:06:40',
    lastTestResult: 'Echo OK — Barcode prefix/suffix parsed cleanly',
    configParams: {
      scannerPrefix: '',
      scannerSuffix: 'ENTER',
      timeoutMs: 1500
    }
  },
  {
    id: 'DEV-DRW-01',
    name: 'Heavy Duty Cash Drawer (Till 1)',
    category: 'CASH_DRAWER',
    connectionType: 'SERIAL_COM',
    portOrAddress: 'RJ11 via Receipt Printer (Pin 2 Kick Pulse)',
    modelManufacturer: 'APG Vasario 1616 / POS-X Heavy Duty',
    status: 'CONNECTED',
    isDefault: true,
    lastTestedAt: '2026-08-15 08:05:20',
    lastTestResult: 'Solenoid Pulse Triggered — Drawer Status Microswitch: CLOSED',
    configParams: {
      drawerPin: 2,
      pulseMs: 120
    }
  },
  {
    id: 'DEV-SCL-01',
    name: 'Deli / Produce Price Computing Scale',
    category: 'WEIGHING_SCALE',
    connectionType: 'SERIAL_COM',
    portOrAddress: 'COM2 (9600-8-N-1)',
    modelManufacturer: 'CAS AP-1 / Mettler Toledo Toledo Protocol (RS232)',
    status: 'CONNECTED',
    isDefault: false,
    lastTestedAt: '2026-08-15 08:08:15',
    lastTestResult: 'Weight Stream Read: 0.000 KG (Zero Stable)',
    configParams: {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'NONE',
      scaleUnit: 'KG',
      continuousReading: true,
      timeoutMs: 2000
    }
  },
  {
    id: 'DEV-PIN-01',
    name: 'Integrated EMV & QR Payment Terminal',
    category: 'PAYMENT_TERMINAL',
    connectionType: 'NETWORK_TCPIP',
    portOrAddress: '192.168.1.185:8080 (Local LAN PINPad)',
    modelManufacturer: 'Ingenico Lane/5000 / PAX D210 Multi-Lane',
    status: 'STANDBY',
    isDefault: true,
    lastTestedAt: '2026-08-15 08:10:00',
    lastTestResult: 'Echo Ping 12ms — Ready for Contactless/Chip/PIN Prompt',
    configParams: {
      ipAddress: '192.168.1.185',
      tcpPort: 8080,
      timeoutMs: 45000
    }
  },
  {
    id: 'DEV-FSC-01',
    name: 'Cryptographic Electronic Tax Register (ETR/ESD)',
    category: 'FISCAL_DEVICE',
    connectionType: 'SERIAL_COM',
    portOrAddress: 'COM4 (115200-8-N-1)',
    modelManufacturer: 'Tremol G03 / Datecs Fiscal Signer Control Unit',
    status: 'CONNECTED',
    isDefault: true,
    lastTestedAt: '2026-08-15 08:00:10',
    lastTestResult: 'Fiscal Memory Status: OPEN, Day #248, Battery OK (4.1V)',
    configParams: {
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'NONE',
      timeoutMs: 5000
    }
  }
];

export const INITIAL_PAYMENT_METHOD_CONFIGS: PaymentMethodConfig[] = [
  {
    id: 'PAY-CASH',
    methodType: 'CASH',
    name: 'Cash (Physical Notes & Coins)',
    isEnabled: true,
    isDefault: true,
    requiresReference: false,
    openCashDrawerOnTender: true,
    allowSplitPayment: true,
    linkedSettlementAccountId: 'ACC-CASH-TILL-01',
    linkedSettlementAccountName: 'Main Till Cash Float (Drawer 1)',
    notes: 'Standard legal tender. Requires drawer kickout on finalized checkout.'
  },
  {
    id: 'PAY-MOMO',
    methodType: 'MOBILE_MONEY',
    name: 'Mobile Money (M-Pesa / EcoCash / Airtel)',
    isEnabled: true,
    isDefault: false,
    requiresReference: true,
    referenceLabel: 'M-Pesa / EcoCash Confirmation Code',
    referenceValidationPattern: '^[A-Z0-9]{8,12}$',
    openCashDrawerOnTender: false,
    allowSplitPayment: true,
    linkedSettlementAccountId: 'ACC-MOMO-SETTLE',
    linkedSettlementAccountName: 'Mobile Money Merchant Settlement Account',
    providerName: 'Safaricom M-Pesa / EcoCash Merchant Paybill',
    merchantOrPaybillNumber: '542901',
    stkPushEnabled: true,
    allowOfflineCapture: true,
    notes: 'Prompt STK push or manually record verified SMS confirmation code from customer.'
  },
  {
    id: 'PAY-CARD',
    methodType: 'DEBIT_CARD',
    name: 'Bank Debit & Credit Card (EMV / Contactless)',
    isEnabled: true,
    isDefault: false,
    requiresReference: true,
    referenceLabel: 'POS Slip Approval Auth Code',
    referenceValidationPattern: '^[0-9A-Z]{4,8}$',
    openCashDrawerOnTender: false,
    allowSplitPayment: true,
    linkedSettlementAccountId: 'ACC-BANK-CARD-01',
    linkedSettlementAccountName: 'Commercial Bank Card Clearing Account',
    providerName: 'Integrated EMV PINPad Gateway',
    autoPromptTerminal: true,
    notes: 'Supports Chip, Contactless NFC, and PIN. Card numbers are never stored locally.'
  },
  {
    id: 'PAY-TRANSFER',
    methodType: 'BANK_TRANSFER',
    name: 'Direct Electronic Funds Transfer (EFT / RTGS)',
    isEnabled: true,
    isDefault: false,
    requiresReference: true,
    referenceLabel: 'Bank Transfer UTR / Reference Number',
    referenceValidationPattern: '^[A-Z0-9-]{6,20}$',
    openCashDrawerOnTender: false,
    allowSplitPayment: true,
    linkedSettlementAccountId: 'ACC-BANK-OPERATING',
    linkedSettlementAccountName: 'First Commercial Operating Account',
    providerName: 'Direct Interbank Clearing',
    requireManagerApprovalIfOverLimit: true,
    maximumAmount: 50000,
    notes: 'For corporate / B2B orders. Requires proof of bank deposit or manager sign-off.'
  },
  {
    id: 'PAY-CREDIT',
    methodType: 'CUSTOMER_CREDIT',
    name: 'Commercial Customer Credit (Debtor Account)',
    isEnabled: true,
    isDefault: false,
    requiresReference: true,
    referenceLabel: 'Customer Purchase Order / Sign-off Ref',
    openCashDrawerOnTender: false,
    allowSplitPayment: true,
    linkedSettlementAccountId: 'ACC-DEBTORS-CONTROL',
    linkedSettlementAccountName: 'Trade Debtors Accounts Receivable Control',
    requireManagerApprovalIfOverLimit: true,
    notes: 'Restricted to approved credit customers within assigned credit limit and net terms.'
  },
  {
    id: 'PAY-OTHER',
    methodType: 'OTHER',
    name: 'Gift Voucher / Store Credit / Loyalty Rebate',
    isEnabled: true,
    isDefault: false,
    requiresReference: true,
    referenceLabel: 'Voucher Serial / Promo Code',
    openCashDrawerOnTender: false,
    allowSplitPayment: true,
    linkedSettlementAccountId: 'ACC-VOUCHER-RESERVE',
    linkedSettlementAccountName: 'Prepaid Vouchers & Store Reserves',
    notes: 'Validates against unredeemed voucher serial numbers.'
  }
];

export const INITIAL_FISCAL_CONFIG: FiscalConfig = {
  fiscalizationEnabled: true,
  jurisdiction: 'Kenya (KRA TIMS/eTIMS Standard Type C)',
  provider: 'Datecs / Tremol Fiscal Memory Control Unit',
  deviceOrServiceMode: 'PHYSICAL_ETR',
  serviceEndpointOrPort: 'COM4 (115200 Baud / 8-N-1)',
  deviceSerialNumber: 'KRA-ETR-2026-098842',
  pinOrTaxId: 'P051289842M',
  status: 'ACTIVE',
  fiscalDayStatus: 'OPEN',
  fiscalDayNumber: 248,
  fiscalDayOpenedAt: '2026-08-15 07:45:00',
  lastZReportDate: '2026-08-14 21:05:12',
  lastZReportNumber: 247,
  pendingDocumentsCount: 2,
  memoryRemainingPercent: 88.4,
  offlineGraceHoursRemaining: 36,
  autoCloseFiscalDayAtMidnight: false,
  printFiscalQrOnReceipt: true,
  queue: [
    {
      id: 'FSC-DOC-001',
      documentNumber: 'INV-2026-0815-0012',
      documentType: 'INVOICE',
      timestamp: '2026-08-15 11:42:10',
      amount: 145.50,
      taxAmount: 18.98,
      status: 'TRANSMITTED',
      retryCount: 0,
      fiscalSignature: 'F7A9-00B2-88C1-99DE-3312',
      qrCodePayload: 'https://itax.kra.go.ke/verification?cu=KRA-ETR-2026-098842&inv=0012&sig=F7A900B2',
      verificationUrl: 'https://itax.kra.go.ke/verification'
    },
    {
      id: 'FSC-DOC-002',
      documentNumber: 'INV-2026-0815-0013',
      documentType: 'INVOICE',
      timestamp: '2026-08-15 12:15:30',
      amount: 320.00,
      taxAmount: 41.74,
      status: 'TRANSMITTED',
      retryCount: 0,
      fiscalSignature: 'A1B2-C3D4-E5F6-7890-9941',
      qrCodePayload: 'https://itax.kra.go.ke/verification?cu=KRA-ETR-2026-098842&inv=0013&sig=A1B2C3D4',
      verificationUrl: 'https://itax.kra.go.ke/verification'
    },
    {
      id: 'FSC-DOC-003',
      documentNumber: 'INV-2026-0815-0014',
      documentType: 'INVOICE',
      timestamp: '2026-08-15 13:02:45',
      amount: 89.25,
      taxAmount: 11.64,
      status: 'SIGNED_OFFLINE',
      retryCount: 1,
      lastError: 'Local fiscal buffer stored. Remote tax gateway timeout.',
      fiscalSignature: '9988-7766-5544-3322-1100',
      qrCodePayload: 'https://itax.kra.go.ke/verification?cu=KRA-ETR-2026-098842&inv=0014&sig=99887766'
    },
    {
      id: 'FSC-DOC-004',
      documentNumber: 'CN-2026-0815-0002',
      documentType: 'CREDIT_NOTE',
      timestamp: '2026-08-15 13:30:10',
      amount: -45.00,
      taxAmount: -5.87,
      status: 'PENDING',
      retryCount: 0,
      lastError: 'Queued for next synchronous cycle'
    }
  ]
};

// --------------------------------------------------------
// PHASE 10: BACKUP MANIFEST & CONTINUITY DATA
// --------------------------------------------------------
import { BackupRecord, BackupRetentionPolicy } from '../types';

export const INITIAL_BACKUP_MANIFEST: BackupRecord[] = [
  {
    backupId: 'BAK-20260819-011000',
    type: 'PRE_MIGRATION',
    createdAt: '2026-08-19 01:10:00',
    applicationVersion: '1.2.0',
    schemaVersion: 16,
    filePath: 'C:\\Users\\Public\\Documents\\SCI\\backup\\Data\\PreMigration\\itredcommerce_2026-08-19_011000.sqlite.bak',
    fileSize: 8452100,
    verificationStatus: 'VERIFIED',
    checksum: 'sha256:4a8e2b9c1d3f5e7a908123456789abcdef012345',
    tenantId: 'TENANT-ITRED-001',
    tablesCount: 28,
    recordsCount: 4280,
    walCheckpointCompleted: true,
    notes: 'Automated pre-migration snapshot before applying Schema v17.',
    initiatedByStaffId: 'STF-001',
    initiatedByStaffName: 'System Administrator'
  },
  {
    backupId: 'BAK-20260818-230000',
    type: 'SCHEDULED',
    createdAt: '2026-08-18 23:00:00',
    applicationVersion: '1.2.0',
    schemaVersion: 16,
    filePath: 'C:\\Users\\Public\\Documents\\SCI\\backup\\Data\\Daily\\itredcommerce_2026-08-18_230000.sqlite.bak',
    fileSize: 8410200,
    verificationStatus: 'VERIFIED',
    checksum: 'sha256:9c1d3f5e7a908123456789abcdef0123454a8e2b',
    tenantId: 'TENANT-ITRED-001',
    tablesCount: 28,
    recordsCount: 4250,
    walCheckpointCompleted: true,
    notes: 'Automated EOD daily scheduled backup.',
    initiatedByStaffId: 'SYSTEM',
    initiatedByStaffName: 'Automated Scheduler'
  },
  {
    backupId: 'BAK-20260818-173000',
    type: 'MANUAL',
    createdAt: '2026-08-18 17:30:00',
    applicationVersion: '1.2.0',
    schemaVersion: 16,
    filePath: 'C:\\Users\\Public\\Documents\\SCI\\backup\\Data\\Manual\\itredcommerce_2026-08-18_173000.sqlite.bak',
    fileSize: 8390400,
    verificationStatus: 'VERIFIED',
    checksum: 'sha256:1d3f5e7a908123456789abcdef0123454a8e2b9c',
    tenantId: 'TENANT-ITRED-001',
    tablesCount: 28,
    recordsCount: 4210,
    walCheckpointCompleted: true,
    notes: 'Manual backup taken before weekly stock variance review.',
    initiatedByStaffId: 'STF-002',
    initiatedByStaffName: 'Sarah Jenkins (Manager)'
  },
  {
    backupId: 'BAK-20260817-230000',
    type: 'SCHEDULED',
    createdAt: '2026-08-17 23:00:00',
    applicationVersion: '1.1.7',
    schemaVersion: 15,
    filePath: 'C:\\Users\\Public\\Documents\\SCI\\backup\\Data\\Daily\\itredcommerce_2026-08-17_230000.sqlite.bak',
    fileSize: 8120500,
    verificationStatus: 'VERIFIED',
    checksum: 'sha256:3f5e7a908123456789abcdef0123454a8e2b9c1d',
    tenantId: 'TENANT-ITRED-001',
    tablesCount: 26,
    recordsCount: 4100,
    walCheckpointCompleted: true,
    notes: 'Automated EOD daily scheduled backup.',
    initiatedByStaffId: 'SYSTEM',
    initiatedByStaffName: 'Automated Scheduler'
  },
  {
    backupId: 'BAK-20260815-180000',
    type: 'PRE_UPDATE',
    createdAt: '2026-08-15 18:00:00',
    applicationVersion: '1.1.6',
    schemaVersion: 14,
    filePath: 'C:\\Users\\Public\\Documents\\SCI\\backup\\Data\\PreUpdate\\itredcommerce_2026-08-15_180000.sqlite.bak',
    fileSize: 7950000,
    verificationStatus: 'VERIFIED',
    checksum: 'sha256:5e7a908123456789abcdef0123454a8e2b9c1d3f',
    tenantId: 'TENANT-ITRED-001',
    tablesCount: 25,
    recordsCount: 3950,
    walCheckpointCompleted: true,
    notes: 'Automated safety backup before software update v1.1.7.',
    initiatedByStaffId: 'STF-001',
    initiatedByStaffName: 'System Administrator'
  },
  {
    backupId: 'BAK-20260814-110000',
    type: 'PRE_RESTORE',
    createdAt: '2026-08-14 11:00:00',
    applicationVersion: '1.1.5',
    schemaVersion: 13,
    filePath: 'C:\\Users\\Public\\Documents\\SCI\\backup\\Data\\RestorePoints\\itredcommerce_2026-08-14_110000.sqlite.bak',
    fileSize: 7800000,
    verificationStatus: 'VERIFIED',
    checksum: 'sha256:7a908123456789abcdef0123454a8e2b9c1d3f5e',
    tenantId: 'TENANT-ITRED-001',
    tablesCount: 24,
    recordsCount: 3820,
    walCheckpointCompleted: true,
    notes: 'Mandatory rollback restore point before test recovery.',
    initiatedByStaffId: 'STF-001',
    initiatedByStaffName: 'System Administrator'
  }
];

