import React, { useEffect, useState } from 'react';
import { ShieldCheck, HardDrive, Cpu, Terminal, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';

export interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(15);
  const [currentStep, setCurrentStep] = useState('Initializing Industrial Core...');

  useEffect(() => {
    const steps = [
      { p: 35, text: 'Verifying Local Storage Tables...' },
      { p: 65, text: 'Checking Peripheral & Hardware Interfaces...' },
      { p: 85, text: 'Loading POS Configuration & Catalog Indexes...' },
      { p: 100, text: 'Ready.' },
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        setProgress(steps[stepIndex].p);
        setCurrentStep(steps[stepIndex].text);
        stepIndex++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          onFinish();
        }, 400);
      }
    }, 450);

    return () => clearInterval(interval);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F9F8F5] text-gray-800 select-none">
      <div className="w-full max-w-md p-6 bg-white border border-gray-300 shadow-2xl flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 text-[11px] font-mono text-gray-500">
          <div className="flex items-center gap-1.5 text-[#FF6B00] font-bold tracking-wider">
            <span className="w-2 h-2 bg-[#FF6B00] inline-block" />
            OFFLINE READY
          </div>
          <div>RELEASE 2026.1</div>
        </div>

        {/* Brand */}
        <div className="my-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#FF6B00] text-white font-black text-2xl mb-3 shadow-sm italic">
            iT
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase font-sans">
            iTred <span className="text-[#FF6B00]">Commerce</span>
          </h1>
          <p className="text-xs text-gray-500 tracking-wider font-mono mt-1">
            Industrial-Grade Point of Sale & Commerce Management
          </p>
        </div>

        {/* System Checklist */}
        <div className="bg-[#F9F8F5] border border-gray-200 p-3 space-y-2 text-xs font-mono mb-4 text-gray-700">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-500">
              <HardDrive className="w-3.5 h-3.5 text-[#FF6B00]" />
              Local Storage:
            </span>
            <span className="text-emerald-700 font-bold">READY</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-500">
              <Cpu className="w-3.5 h-3.5 text-[#FF6B00]" />
              Commerce Core Engine:
            </span>
            <span className="text-emerald-700 font-bold">OPERATIONAL</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
              Security Check:
            </span>
            <span className="text-emerald-700 font-bold">PASS</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-500">
              <Terminal className="w-3.5 h-3.5 text-[#FF6B00]" />
              Terminal ID:
            </span>
            <span className="text-gray-900 font-bold">POS-D01</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 h-2 border border-gray-300 overflow-hidden mb-2">
          <div
            className="bg-[#FF6B00] h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-gray-500">
          <span className="truncate max-w-[280px]">{currentStep}</span>
          <span className="text-[#FF6B00] font-bold">{progress}%</span>
        </div>

        {/* Skip button if user wants immediate access */}
        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onFinish}
            className="text-gray-600 hover:text-[#FF6B00] text-xs"
            rightIcon={<ArrowRight className="w-3 h-3" />}
          >
            Skip Launch Check
          </Button>
        </div>
      </div>
    </div>
  );
};
