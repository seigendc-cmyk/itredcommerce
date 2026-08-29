import React, { useEffect, useState } from 'react';
import { User, KeyRound, ShieldCheck, ArrowRight, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { StaffMember } from '../../types';
import { apiGet, apiPost, ApiClientError } from '../../api/client';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';

export interface StaffAccessScreenProps {
  onAuthenticated: (staff: StaffMember) => void;
  onBackToWelcome?: () => void;
}

export const StaffAccessScreen: React.FC<StaffAccessScreenProps> = ({
  onAuthenticated,
  onBackToWelcome,
}) => {
  const [staffRoster, setStaffRoster] = useState<StaffMember[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [accessCode, setAccessCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authenticatingStaffId, setAuthenticatingStaffId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<StaffMember[]>('/auth/staff')
      .then((staff) => {
        setStaffRoster(staff);
        setSelectedStaff((prev) => prev ?? staff[0] ?? null);
      })
      .catch(() => setRosterError('Unable to reach the authentication server. Confirm the backend is running.'));
  }, []);

  const handleKeypadPress = (digit: string) => {
    if (accessCode.length < 6) {
      setAccessCode((prev) => prev + digit);
      setErrorMessage(null);
    }
  };

  const handleBackspace = () => {
    setAccessCode((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    setAccessCode('');
    setErrorMessage(null);
  };

  const handleAuthorize = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedStaff || !accessCode.trim() || isVerifying) return;

    setIsVerifying(true);
    setAuthenticatingStaffId(selectedStaff.id);
    setErrorMessage(null);
    try {
      const { staff } = await apiPost<{ staff: StaffMember }>('/auth/login', {
        staffId: selectedStaff.id,
        pin: accessCode,
      });
      onAuthenticated(staff);
    } catch (err) {
      setAuthenticatingStaffId(null);
      if (err instanceof ApiClientError && err.status === 429) {
        setErrorMessage('Too many failed attempts. Please wait a moment before trying again.');
      } else {
        setErrorMessage(`Invalid PIN for ${selectedStaff.name}.`);
      }
      setAccessCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F5] flex flex-col justify-between select-none">
      {/* Sleek Orange Header */}
      <header className="h-12 bg-[#FF6B00] text-white px-4 flex items-center justify-between shadow-sm border-b border-[#E05E00]">
        <div className="flex items-center space-x-2">
          <div className="font-black text-xl tracking-tighter italic select-none">
            iTred<span className="font-light not-italic">Commerce</span>
          </div>
          <div className="h-6 w-[1px] bg-white/20 mx-2 hidden sm:block" />
          <p className="text-xs font-semibold uppercase tracking-widest text-white/90 hidden sm:block">
            Staff Access & Operator Control
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-white">
          <div className="hidden sm:flex items-center bg-black/10 px-2.5 py-1 rounded-sm border border-white/20 font-mono text-[11px]">
            <span>Terminal: <strong>POS-D01</strong></span>
          </div>
          {onBackToWelcome && (
            <Button variant="ghost" size="sm" onClick={onBackToWelcome} className="text-white hover:bg-white/20 text-xs border border-white/20">
              Back to Start
            </Button>
          )}
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col items-center justify-center flex-1">
        <div className="w-full max-w-3xl bg-white border border-gray-300 shadow-xl overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Column: Staff Member Selection & Quick Access */}
          <div className="md:w-6/12 bg-[#F9F8F5] border-r border-gray-200 p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-700 pb-2 border-b border-gray-200 flex items-center justify-between mb-3">
                <span className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#FF6B00]" />
                  Select Staff Access Card
                </span>
                <span className="text-[10px] text-gray-500 font-normal">Click to select or tap</span>
              </div>

              {rosterError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium p-2 bg-rose-50 border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{rosterError}</span>
                </div>
              )}

              <div className="space-y-2">
                {staffRoster.map((staff) => {
                  const isSelected = selectedStaff?.id === staff.id;
                  const isThisAuthenticating = authenticatingStaffId === staff.id;
                  return (
                    <div
                      key={staff.id}
                      onClick={() => {
                        setSelectedStaff(staff);
                        setAccessCode('');
                        setErrorMessage(null);
                      }}
                      className={`w-full text-left p-2.5 border transition-all cursor-pointer select-none rounded-none flex items-center justify-between ${
                        isSelected
                          ? 'bg-white border-[#FF6B00] shadow-sm ring-1 ring-[#FF6B00]'
                          : 'bg-white/80 border-gray-200 hover:border-gray-400 hover:bg-white text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 flex items-center justify-center font-bold text-xs border shrink-0 ${
                            isSelected
                              ? 'bg-[#FF6B00] text-white border-orange-600'
                              : 'bg-gray-200 text-gray-700 border-gray-300'
                          }`}
                        >
                          {isThisAuthenticating ? <RefreshCw className="w-4 h-4 animate-spin" /> : staff.avatarInitials}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900 leading-tight flex items-center gap-1.5">
                            {staff.name}
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {staff.roleTitle}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Profile permission summary */}
            {selectedStaff && (
              <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-600 font-mono space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-semibold uppercase">Selected Operator:</span>
                  <span className="font-bold text-gray-900">{selectedStaff.name} ({selectedStaff.roleTitle})</span>
                </div>
                <div className="text-gray-800 text-[11px]">
                  {selectedStaff.permissions.includes('*')
                    ? 'Full Administrative & Financial Rights'
                    : selectedStaff.permissions.join(', ')}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Code Entry & Keypad */}
          <div className="md:w-6/12 p-6 flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#FF6B00]" />
                    Staff Access Code
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Authorized operator: <strong className="text-gray-800">{selectedStaff?.name ?? '—'}</strong>
                  </p>
                </div>
                <StatusBadge status="Ready" size="sm" />
              </div>

              {/* Pin Display */}
              <form onSubmit={handleAuthorize} className="space-y-4">
                <div>
                  <div className="relative flex items-center bg-[#F9F8F5] border border-gray-300 p-2.5 focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00]">
                    <Lock className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                    <input
                      type="password"
                      maxLength={6}
                      value={accessCode}
                      onChange={(e) => {
                        setAccessCode(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="Enter your PIN"
                      disabled={!selectedStaff}
                      className="w-full text-lg font-mono font-bold tracking-widest text-gray-900 bg-transparent focus:outline-none placeholder:text-xs placeholder:font-normal placeholder:tracking-normal"
                      autoFocus
                    />
                    {accessCode && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="text-xs text-gray-500 hover:text-gray-800 font-mono px-1.5 py-0.5 border border-gray-300 bg-white"
                      >
                        CLEAR
                      </button>
                    )}
                  </div>
                  {errorMessage && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>

                {/* Touch Keypad */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="py-2.5 bg-gray-50 hover:bg-orange-50 active:bg-orange-100 border border-gray-200 hover:border-orange-300 text-gray-800 font-mono font-bold text-base transition-colors cursor-pointer select-none rounded-none shadow-2xs"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-mono text-xs font-bold uppercase cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="py-2.5 bg-gray-50 hover:bg-orange-50 active:bg-orange-100 border border-gray-200 hover:border-orange-300 text-gray-800 font-mono font-bold text-base transition-colors cursor-pointer select-none rounded-none shadow-2xs"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-mono text-xs font-bold uppercase cursor-pointer"
                  >
                    ⌫ Del
                  </button>
                </div>

                {/* Authorize Button */}
                <div className="pt-2 space-y-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isVerifying}
                    disabled={!selectedStaff || !accessCode.trim()}
                    className="w-full"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Authorize Staff Access
                  </Button>
                </div>
              </form>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 text-center text-[10px] font-mono text-gray-400">
              Assigned by SysAdmin • Granular role verification ready
            </div>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="bg-white border-t border-gray-300 px-6 py-2 text-xs text-gray-500 flex items-center justify-between font-mono">
        <div>Station: <strong className="text-gray-800">POS-D01</strong></div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Role-Based Access Control</span>
        </div>
      </footer>
    </div>
  );
};
