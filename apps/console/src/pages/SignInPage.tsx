import React, { useState } from 'react';
import { useConsoleAuth } from '../lib/consoleAuth';

export const SignInPage: React.FC<{ unauthorized?: boolean }> = ({ unauthorized }) => {
  const { signIn } = useConsoleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
        <div className="font-black text-lg tracking-tighter italic">
          iTred<span className="font-light not-italic">Console</span>
        </div>
        {unauthorized && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">
            That account is not a console operator.
          </p>
        )}
        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">{error}</p>
        )}
        <div className="space-y-1">
          <label className="text-xs text-slate-400" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#FF6B00]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#FF6B00]"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#FF6B00] text-white text-sm font-semibold py-2 rounded disabled:opacity-50"
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};
