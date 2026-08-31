import React, { useEffect, useState } from 'react';
import { User, KeyRound, Truck, ArrowRight, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { StatusBadge } from '@shared/components/ui/StatusBadge';
import { fetchRiderRoster, signInRider, RiderAuthError, type RosterEntry, type RiderSignInResult } from '../lib/authApi';

// Forked from executive-pwa/src/components/ExecutiveSignInScreen.tsx
// (itself forked from src/components/auth/StaffAccessScreen.tsx) — same
// PIN-pad UX, hitting rider-roster/rider-signin instead.

export interface RiderSignInScreenProps {
  onAuthenticated: (result: RiderSignInResult) => void;
}

export const RiderSignInScreen: React.FC<RiderSignInScreenProps> = ({ onAuthenticated }) => {
  const [staffRoster, setStaffRoster] = useState<RosterEntry[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<RosterEntry | null>(null);
  const [accessCode, setAccessCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [authenticatingStaffId, setAuthenticatingStaffId] = useState<string | null>(null);

  useEffect(() => {
    fetchRiderRoster()
      .then((staff) => {
        setStaffRoster(staff);
        setSelectedStaff((prev) => prev ?? staff[0] ?? null);
      })
      .catch(() => setRosterError('Unable to reach Supabase. Check your connection and try again.'));
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
      const result = await signInRider(selectedStaff.id, accessCode);
      onAuthenticated(result);
    } catch (err) {
      setAuthenticatingStaffId(null);
      if (err instanceof RiderAuthError && err.code === 'LOCKED_OUT') {
        setErrorMessage('Too many failed attempts. Please wait a moment before trying again.');
      } else if (err instanceof RiderAuthError && err.code === 'NOT_RIDER') {
        setErrorMessage('This app is only available to rider-role staff.');
      } else {
        setErrorMessage(`Invalid PIN for ${selectedStaff.name}.`);
      }
      setAccessCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between select-none">
      <header className="h-12 bg-[#FF6B00] text-white px-4 flex items-center justify-between shadow-sm border-b border-[#E05E00]">
        <div className="flex items-center space-x-2">
          <div className="font-black text-xl tracking-tighter italic select-none">
            iTred<span className="font-light not-italic">Rider</span>
          </div>
          <div className="h-6 w-[1px] bg-white/20 mx-2 hidden sm:block" />
          <p className="text-xs font-semibold uppercase tracking-widest text-white/90 hidden sm:block">
            Delivery Broadcast Board
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col items-center justify-center flex-1">
        <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 shadow-xl overflow-hidden flex flex-col md:flex-row">
          <div className="md:w-6/12 bg-slate-900 border-r border-slate-700 p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 pb-2 border-b border-slate-700 flex items-center justify-between mb-3">
                <span className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#FF6B00]" />
                  Select Rider
                </span>
              </div>

              {rosterError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium p-2 bg-rose-950/50 border border-rose-800">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{rosterError}</span>
                </div>
              )}

              {!rosterError && staffRoster.length === 0 && (
                <div className="text-xs text-slate-500 p-2">No rider-role staff found for this tenant.</div>
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
                      className={`w-full text-left p-2.5 border transition-all cursor-pointer select-none flex items-center justify-between ${
                        isSelected
                          ? 'bg-slate-800 border-[#FF6B00] shadow-sm ring-1 ring-[#FF6B00]'
                          : 'bg-slate-900 border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 flex items-center justify-center font-bold text-xs border shrink-0 ${
                            isSelected ? 'bg-[#FF6B00] text-white border-orange-600' : 'bg-slate-700 text-slate-200 border-slate-600'
                          }`}
                        >
                          {isThisAuthenticating ? <RefreshCw className="w-4 h-4 animate-spin" /> : staff.avatarInitials}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 leading-tight flex items-center gap-1.5">
                            {staff.name}
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{staff.roleTitle}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="md:w-6/12 p-6 flex flex-col justify-between bg-slate-950">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#FF6B00]" />
                    Access PIN
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Signing in as: <strong className="text-slate-200">{selectedStaff?.name ?? '—'}</strong>
                  </p>
                </div>
                <StatusBadge status="Ready" size="sm" />
              </div>

              <form onSubmit={handleAuthorize} className="space-y-4">
                <div>
                  <div className="relative flex items-center bg-slate-900 border border-slate-700 p-2.5 focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00]">
                    <Lock className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
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
                      className="w-full text-lg font-mono font-bold tracking-widest text-slate-100 bg-transparent focus:outline-none placeholder:text-xs placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-500"
                      autoFocus
                    />
                    {accessCode && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="text-xs text-slate-400 hover:text-slate-100 font-mono px-1.5 py-0.5 border border-slate-600 bg-slate-800"
                      >
                        CLEAR
                      </button>
                    )}
                  </div>
                  {errorMessage && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium mt-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-slate-700 hover:border-orange-500 text-slate-100 font-mono font-bold text-base transition-colors cursor-pointer select-none shadow-2xs"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono text-xs font-bold uppercase cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-slate-700 hover:border-orange-500 text-slate-100 font-mono font-bold text-base transition-colors cursor-pointer select-none shadow-2xs"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono text-xs font-bold uppercase cursor-pointer"
                  >
                    ⌫ Del
                  </button>
                </div>

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
                    Sign In
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 border-t border-slate-700 px-6 py-2 text-xs text-slate-400 flex items-center justify-between font-mono">
        <div>Always-Online • Pull Model • Single Tenant</div>
        <div className="flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Rider Role Access Only</span>
        </div>
      </footer>
    </div>
  );
};
