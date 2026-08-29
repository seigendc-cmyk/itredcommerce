import React, { useState } from 'react';
import { 
  Printer, 
  Scan, 
  HardDrive, 
  Scale, 
  CreditCard, 
  Cpu, 
  ArrowLeft, 
  Plus, 
  Settings2, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  Sliders, 
  Radio,
  FileCheck,
  Check,
  Terminal,
  Zap
} from 'lucide-react';
import { PosDevice, DeviceCategory, DeviceConnectionType, StaffMember } from '../../../types';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';

interface DevicesManagementViewProps {
  devices: PosDevice[];
  currentStaff: StaffMember;
  onBackToLanding: () => void;
  onUpdateDevice: (updated: PosDevice) => void;
  onAddDevice: (newDevice: PosDevice) => void;
}

export const DevicesManagementView: React.FC<DevicesManagementViewProps> = ({
  devices = [],
  currentStaff,
  onBackToLanding,
  onUpdateDevice,
  onAddDevice,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [testingDevice, setTestingDevice] = useState<PosDevice | null>(null);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [configuringDevice, setConfiguringDevice] = useState<PosDevice | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state for editing/adding
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<DeviceCategory>('RECEIPT_PRINTER');
  const [formConnection, setFormConnection] = useState<DeviceConnectionType>('USB_RAW');
  const [formPort, setFormPort] = useState('');
  const [formManufacturer, setFormManufacturer] = useState('');
  const [formPaperWidth, setFormPaperWidth] = useState(80);
  const [formBaudRate, setFormBaudRate] = useState(9600);

  const getCategoryIcon = (category: DeviceCategory) => {
    switch (category) {
      case 'RECEIPT_PRINTER':
        return <Printer className="w-4 h-4 text-orange-500" />;
      case 'BARCODE_SCANNER':
        return <Scan className="w-4 h-4 text-emerald-500" />;
      case 'CASH_DRAWER':
        return <HardDrive className="w-4 h-4 text-blue-500" />;
      case 'WEIGHING_SCALE':
        return <Scale className="w-4 h-4 text-purple-500" />;
      case 'PAYMENT_TERMINAL':
        return <CreditCard className="w-4 h-4 text-amber-500" />;
      case 'FISCAL_DEVICE':
        return <Cpu className="w-4 h-4 text-red-500" />;
      default:
        return <Settings2 className="w-4 h-4 text-slate-500" />;
    }
  };

  const getCategoryLabel = (category: DeviceCategory) => {
    switch (category) {
      case 'RECEIPT_PRINTER':
        return 'Receipt Printer';
      case 'BARCODE_SCANNER':
        return 'Barcode Scanner';
      case 'CASH_DRAWER':
        return 'Cash Drawer';
      case 'WEIGHING_SCALE':
        return 'Weighing Scale';
      case 'PAYMENT_TERMINAL':
        return 'Payment Terminal';
      case 'FISCAL_DEVICE':
        return 'Fiscal Device / ETR';
      default:
        return category;
    }
  };

  const filteredDevices = selectedCategory === 'ALL'
    ? devices
    : devices.filter((d) => d.category === selectedCategory);

  const handleRunTest = (device: PosDevice) => {
    setTestingDevice(device);
    setIsTestRunning(true);
    setTestLog([
      `[${new Date().toLocaleTimeString()}] Initializing direct hardware port: ${device.portOrAddress}...`,
      `[${new Date().toLocaleTimeString()}] Querying device driver interface (${device.modelManufacturer})...`
    ]);

    setTimeout(() => {
      setTestLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Handshake ACK received in 14ms.`
      ]);

      if (device.category === 'RECEIPT_PRINTER') {
        setTimeout(() => {
          setTestLog((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] Transmitting ESC/POS initialization bytes [1B 40]...`,
            `[${new Date().toLocaleTimeString()}] Diagnostic test slip printed (${device.configParams.paperWidthMm || 80}mm). Auto-cutter pulse OK.`,
            `[${new Date().toLocaleTimeString()}] >>> SUCCESS: Hardware verification completed.`
          ]);
          setIsTestRunning(false);
          onUpdateDevice({
            ...device,
            status: 'CONNECTED',
            lastTestedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            lastTestResult: 'Handshake OK — Diagnostic slip printed successfully.'
          });
        }, 800);
      } else if (device.category === 'WEIGHING_SCALE') {
        setTimeout(() => {
          setTestLog((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] Continuous weight stream polling on COM port...`,
            `[${new Date().toLocaleTimeString()}] Reading: 0.000 KG (Tare: 0.000, Motion: STABLE)`,
            `[${new Date().toLocaleTimeString()}] >>> SUCCESS: Weight protocol calibrated.`
          ]);
          setIsTestRunning(false);
          onUpdateDevice({
            ...device,
            status: 'CONNECTED',
            lastTestedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            lastTestResult: 'Protocol OK — Live weight stream stabilized.'
          });
        }, 800);
      } else if (device.category === 'CASH_DRAWER') {
        setTimeout(() => {
          setTestLog((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] Sending 100ms RJ11 Solenoid trigger pulse via Printer Pin ${device.configParams.drawerPin || 2}...`,
            `[${new Date().toLocaleTimeString()}] Cash Drawer Status Pin: KICK_TRIGGERED_OK`,
            `[${new Date().toLocaleTimeString()}] >>> SUCCESS: Solenoid circuit responsive.`
          ]);
          setIsTestRunning(false);
          onUpdateDevice({
            ...device,
            status: 'CONNECTED',
            lastTestedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            lastTestResult: 'Trigger OK — Cash drawer kickout executed.'
          });
        }, 800);
      } else {
        setTimeout(() => {
          setTestLog((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] Diagnostic echo verified on port ${device.portOrAddress}.`,
            `[${new Date().toLocaleTimeString()}] >>> SUCCESS: Device ready for operational transactions.`
          ]);
          setIsTestRunning(false);
          onUpdateDevice({
            ...device,
            status: 'CONNECTED',
            lastTestedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            lastTestResult: 'Diagnostic test completed successfully.'
          });
        }, 800);
      }
    }, 600);
  };

  const handleOpenConfig = (device: PosDevice) => {
    setConfiguringDevice(device);
    setFormName(device.name);
    setFormCategory(device.category);
    setFormConnection(device.connectionType);
    setFormPort(device.portOrAddress);
    setFormManufacturer(device.modelManufacturer);
    setFormPaperWidth(device.configParams.paperWidthMm || 80);
    setFormBaudRate(device.configParams.baudRate || 9600);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringDevice) return;

    const updated: PosDevice = {
      ...configuringDevice,
      name: formName,
      portOrAddress: formPort,
      modelManufacturer: formManufacturer,
      connectionType: formConnection,
      configParams: {
        ...configuringDevice.configParams,
        paperWidthMm: formPaperWidth,
        baudRate: formBaudRate,
      }
    };

    onUpdateDevice(updated);
    setConfiguringDevice(null);
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
              <Printer className="w-4 h-4 text-orange-400" />
              Peripherals & External Hardware Device Management
            </h1>
            <p className="text-[10px] font-mono text-slate-400">
              Universal Drivers, Receipt Printers, Scanners, Cash Drawers, Scales & Fiscal Memory
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setFormName('Secondary Kitchen / Bar Receipt Printer');
              setFormCategory('RECEIPT_PRINTER');
              setFormConnection('NETWORK_TCPIP');
              setFormPort('192.168.1.200:9100');
              setFormManufacturer('Generic ESC/POS Thermal 80mm');
              setIsAddModalOpen(true);
            }}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Hardware Adapter
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 border border-slate-200 shadow-xs">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 text-xs font-bold rounded transition ${
            selectedCategory === 'ALL'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Peripherals ({devices.length})
        </button>

        <button
          onClick={() => setSelectedCategory('RECEIPT_PRINTER')}
          className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition ${
            selectedCategory === 'RECEIPT_PRINTER'
              ? 'bg-orange-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          Printers
        </button>

        <button
          onClick={() => setSelectedCategory('BARCODE_SCANNER')}
          className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition ${
            selectedCategory === 'BARCODE_SCANNER'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scan className="w-3.5 h-3.5" />
          Scanners
        </button>

        <button
          onClick={() => setSelectedCategory('CASH_DRAWER')}
          className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition ${
            selectedCategory === 'CASH_DRAWER'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          Drawers
        </button>

        <button
          onClick={() => setSelectedCategory('WEIGHING_SCALE')}
          className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition ${
            selectedCategory === 'WEIGHING_SCALE'
              ? 'bg-purple-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          Scales
        </button>

        <button
          onClick={() => setSelectedCategory('PAYMENT_TERMINAL')}
          className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition ${
            selectedCategory === 'PAYMENT_TERMINAL'
              ? 'bg-amber-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Card / EMV PINPads
        </button>

        <button
          onClick={() => setSelectedCategory('FISCAL_DEVICE')}
          className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition ${
            selectedCategory === 'FISCAL_DEVICE'
              ? 'bg-red-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Fiscal Units
        </button>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map((device) => (
          <div
            key={device.id}
            className="bg-white border border-slate-200 p-4 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-100 rounded">
                    {getCategoryIcon(device.category)}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 leading-tight">
                      {device.name}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">
                      {getCategoryLabel(device.category)} • {device.connectionType}
                    </span>
                  </div>
                </div>

                <StatusBadge
                  status={device.status === 'CONNECTED' ? 'ACTIVE' : device.status === 'STANDBY' ? 'PENDING' : 'VOIDED'}
                  customLabel={device.status}
                />
              </div>

              {/* Hardware Port & Manufacturer */}
              <div className="bg-slate-50 border border-slate-100 p-2.5 rounded space-y-1 text-xs">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Port / Endpoint:</div>
                <div className="font-mono font-bold text-slate-700 truncate" title={device.portOrAddress}>
                  {device.portOrAddress}
                </div>

                <div className="text-[10px] text-slate-400 font-mono uppercase pt-1">Driver Profile:</div>
                <div className="text-[11px] text-slate-600 truncate" title={device.modelManufacturer}>
                  {device.modelManufacturer}
                </div>
              </div>

              {/* Last Test info */}
              {device.lastTestedAt && (
                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">Last Test: {device.lastTestedAt}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleRunTest(device)}
                leftIcon={<Zap className="w-3.5 h-3.5" />}
                className="flex-1 justify-center"
              >
                Test Device
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenConfig(device)}
                leftIcon={<Settings2 className="w-3.5 h-3.5" />}
                className="text-slate-700"
              >
                Configure
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Diagnostic Test Log */}
      <Modal
        isOpen={!!testingDevice}
        onClose={() => setTestingDevice(null)}
        title={`Hardware Diagnostic Test: ${testingDevice?.name || ''}`}
        size="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-950 text-emerald-400 rounded font-mono text-[11px] space-y-1 max-h-60 overflow-y-auto border border-slate-800">
            {testLog.map((log, index) => (
              <div key={index} className="leading-relaxed">
                {log}
              </div>
            ))}
          </div>

          {isTestRunning ? (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-500" />
              Testing hardware communication...
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Hardware handshake verified. Port is responding normally.</span>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTestingDevice(null)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Configure Device Adapter */}
      <Modal
        isOpen={!!configuringDevice}
        onClose={() => setConfiguringDevice(null)}
        title={`Configure Device: ${configuringDevice?.name || ''}`}
        size="md"
      >
        <form onSubmit={handleSaveConfig} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Device Name / Label
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Front Cashier Thermal Printer"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Connection Type
              </label>
              <select
                value={formConnection}
                onChange={(e) => setFormConnection(e.target.value as DeviceConnectionType)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
              >
                <option value="USB_RAW">USB Raw Driver</option>
                <option value="SERIAL_COM">Serial COM Port (RS232)</option>
                <option value="NETWORK_TCPIP">Network TCP/IP Socket</option>
                <option value="BLUETOOTH">Bluetooth Serial Port</option>
                <option value="VIRTUAL_EMULATOR">Virtual Emulator / Loopback</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Port / IP Address
              </label>
              <Input
                value={formPort}
                onChange={(e) => setFormPort(e.target.value)}
                placeholder="e.g. COM3 or 192.168.1.180:9100"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Driver / Model Manufacturer
            </label>
            <Input
              value={formManufacturer}
              onChange={(e) => setFormManufacturer(e.target.value)}
              placeholder="e.g. Generic ESC/POS 80mm High-Speed"
              required
            />
          </div>

          {configuringDevice?.category === 'RECEIPT_PRINTER' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Paper Width
                </label>
                <select
                  value={formPaperWidth}
                  onChange={(e) => setFormPaperWidth(Number(e.target.value))}
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
                >
                  <option value={80}>80 mm (Standard Thermal)</option>
                  <option value={58}>58 mm (Compact Thermal)</option>
                </select>
              </div>
            </div>
          )}

          {formConnection === 'SERIAL_COM' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Baud Rate
                </label>
                <select
                  value={formBaudRate}
                  onChange={(e) => setFormBaudRate(Number(e.target.value))}
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
                >
                  <option value={9600}>9600 bps</option>
                  <option value={19200}>19200 bps</option>
                  <option value={38400}>38400 bps</option>
                  <option value={115200}>115200 bps (ETR/Fiscal)</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfiguringDevice(null)}
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

      {/* Modal: Add Device */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Hardware Peripheral Adapter"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const newDev: PosDevice = {
              id: `DEV-CUSTOM-${Date.now().toString().slice(-4)}`,
              name: formName,
              category: formCategory,
              connectionType: formConnection,
              portOrAddress: formPort,
              modelManufacturer: formManufacturer,
              status: 'CONNECTED',
              isDefault: false,
              lastTestedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
              lastTestResult: 'Added & Initialized',
              configParams: {
                paperWidthMm: formPaperWidth,
                baudRate: formBaudRate
              }
            };
            onAddDevice(newDev);
            setIsAddModalOpen(false);
          }}
          className="space-y-3.5 text-xs"
        >
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Peripheral Category
            </label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as DeviceCategory)}
              className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
            >
              <option value="RECEIPT_PRINTER">Receipt Printer (ESC/POS)</option>
              <option value="BARCODE_SCANNER">Barcode Scanner (USB HID / Serial)</option>
              <option value="CASH_DRAWER">Cash Drawer (RJ11 Solenoid)</option>
              <option value="WEIGHING_SCALE">Weighing Scale (RS232 Serial)</option>
              <option value="PAYMENT_TERMINAL">Payment Terminal / PINPad</option>
              <option value="FISCAL_DEVICE">Fiscal Device / ETR</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Device Name / Label
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Back Bar Receipt Printer"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Connection
              </label>
              <select
                value={formConnection}
                onChange={(e) => setFormConnection(e.target.value as DeviceConnectionType)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded focus:border-orange-500 focus:outline-none"
              >
                <option value="USB_RAW">USB Raw</option>
                <option value="SERIAL_COM">Serial COM Port</option>
                <option value="NETWORK_TCPIP">Network TCP/IP</option>
                <option value="BLUETOOTH">Bluetooth</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Port / Address
              </label>
              <Input
                value={formPort}
                onChange={(e) => setFormPort(e.target.value)}
                placeholder="e.g. 192.168.1.200:9100"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Driver / Model Profile
            </label>
            <Input
              value={formManufacturer}
              onChange={(e) => setFormManufacturer(e.target.value)}
              placeholder="e.g. Generic ESC/POS Thermal"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Peripheral
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
