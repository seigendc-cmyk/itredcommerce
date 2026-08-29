import React, { useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, ShieldCheck, ArrowRight, Server, HardDrive, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';

export interface WelcomeUpdateScreenProps {
  onContinueToStaffAccess: () => void;
}

export const WelcomeUpdateScreen: React.FC<WelcomeUpdateScreenProps> = ({
  onContinueToStaffAccess,
}) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'up-to-date' | 'checked'>('idle');

  const handleCheckUpdates = () => {
    setCheckingUpdate(true);
    setTimeout(() => {
      setCheckingUpdate(false);
      setUpdateStatus('up-to-date');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#F9F8F5] flex flex-col justify-between select-none">
      {/* Sleek Orange Header Bar */}
      <header className="h-12 bg-[#FF6B00] text-white px-4 flex items-center justify-between shadow-sm border-b border-[#E05E00]">
        <div className="flex items-center space-x-2">
          <div className="font-black text-xl tracking-tighter italic select-none">
            iTred<span className="font-light not-italic">Commerce</span>
          </div>
          <div className="h-6 w-[1px] bg-white/20 mx-2 hidden sm:block" />
          <p className="text-xs font-semibold uppercase tracking-widest text-white/90 hidden sm:block">
            Point of Sale System • Terminal #POS-D01
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-black/10 border border-white/20 text-white text-xs font-mono">
            <WifiOff className="w-3.5 h-3.5 text-white" />
            <span>OFFLINE CAPABLE MODE</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col items-center justify-center flex-1">
        {/* Welcome Header */}
        <div className="w-full text-center mb-8">
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight font-sans">
            Welcome to iTred Commerce
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-lg mx-auto">
            Industrial commercial workstation. Full business transactions, sales registers, and catalog management operate continuously with or without active network connectivity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full max-w-3xl">
          {/* Offline Capability Card */}
          <div className="md:col-span-6 bg-white border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-[#FF6B00]" />
                  Offline Operations
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  READY
                </span>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed mb-4">
                Local transaction journals, catalog prices, barcodes, and inventory registers are primed for zero-latency local execution. No active internet required to tender sales or manage inventory.
              </p>

              <div className="space-y-2 bg-[#F9F8F5] p-3 border border-gray-200 text-xs text-gray-700 font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Local Journal:</span>
                  <span className="font-bold text-gray-900">Synchronized</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Hardware Cash Drawer:</span>
                  <span className="font-bold text-gray-900">Connected</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Thermal Receipt Printer:</span>
                  <span className="font-bold text-gray-900">Online (ESC/POS)</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <Button
                variant="primary"
                size="lg"
                onClick={onContinueToStaffAccess}
                className="w-full"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue Offline (Workstation)
              </Button>
            </div>
          </div>

          {/* Update Card */}
          <div className="md:col-span-6 bg-white border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-gray-700" />
                  Software Updates
                </span>
                <span className="text-xs font-mono text-gray-500 font-medium">v2026.1.0</span>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed mb-4">
                You may periodically verify if catalog updates, fiscal rate changes, or software enhancements are available from the central distribution server.
              </p>

              {updateStatus === 'up-to-date' ? (
                <div className="bg-emerald-50 border border-emerald-300 p-3 flex items-start gap-2.5 text-xs text-emerald-900 mb-4">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold uppercase tracking-wider">System Up To Date</div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      Workstation is running the latest verified production build.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 p-3 flex items-start gap-2.5 text-xs text-gray-600 mb-4">
                  <Info className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-snug">
                    Updates will not interrupt ongoing offline sessions or local transaction integrity.
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 flex flex-col gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={handleCheckUpdates}
                isLoading={checkingUpdate}
                leftIcon={<RefreshCw className="w-4 h-4" />}
                className="w-full"
              >
                {checkingUpdate ? 'Checking Distribution Server...' : 'Check for Updates'}
              </Button>

              <p className="text-[11px] text-gray-500 text-center font-mono">
                Updates are optional and never forced
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer info bar */}
      <footer className="bg-white border-t border-gray-300 px-6 py-2 text-xs text-gray-500 flex flex-wrap items-center justify-between font-mono">
        <div className="flex items-center gap-4">
          <span>Terminal: <strong className="text-gray-900">POS-D01 (Main Register)</strong></span>
          <span className="hidden sm:inline">•</span>
          <span>Branch: <strong className="text-gray-900">Central Distribution #01</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Local Security Policy Enforced</span>
        </div>
      </footer>
    </div>
  );
};
