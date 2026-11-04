import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, KeyRound, LoaderCircle, X } from 'lucide-react';
import { apiFetch } from '../../auth/session';

const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

export function Modal({ titleId, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {children}
      </section>
    </div>
  );
}

const formatDate = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';

/**
 * Lets staff create or reset the login (ID + password) for a manager, driver or customer,
 * and enable or disable it. Super admin manages managers; admin and managers manage drivers/customers.
 */
export default function LoginAccessDialog({ role, profileId, personName, suggestedLoginId = '', onClose }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch(`/auth/accounts/${role}/${profileId}`)
      .then((result) => {
        if (!active) return;
        const existing = result.data?.account || null;
        setAccount(existing);
        setLoginId(existing?.loginId || suggestedLoginId);
        setStatus(existing?.status || 'Active');
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, profileId, suggestedLoginId]);

  async function save(event) {
    event.preventDefault();
    if (!account && password.length < 8) {
      setError('Set a password of at least 8 characters to create this login.');
      return;
    }
    if (account && password && password.length < 8) {
      setError('The new password must be at least 8 characters.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await apiFetch(`/auth/accounts/${role}/${profileId}`, {
        method: 'PUT',
        body: { loginId: loginId.trim(), password, status }
      });
      setAccount(result.data.account);
      setLoginId(result.data.account.loginId);
      setPassword('');
      setNotice(password
        ? `Login saved. Share the login ID and new password with ${personName || 'this person'}.`
        : 'Login saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal titleId="login-access-title" onClose={onClose}>
      <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Login access</p>
          <h2 id="login-access-title" className="mt-1 text-lg font-bold text-slate-900">{personName || 'Login'}</h2>
          {!loading && (
            <p className="mt-1 text-xs text-slate-500">
              {account ? `Last sign-in: ${formatDate(account.lastLoginAt)}` : 'No login yet. Create one below.'}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </header>
      {loading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-12 text-xs text-slate-500"><LoaderCircle size={16} className="animate-spin text-emerald-700" />Loading login…</div>
      ) : (
        <form onSubmit={save} className="space-y-4 px-5 py-5" noValidate>
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
          {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><Check size={15} className="mt-0.5 shrink-0" />{notice}</div>}
          <label className="block text-xs font-semibold text-slate-700">
            Login ID
            <input value={loginId} onChange={(event) => setLoginId(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} className={inputClass} />
            <span className="mt-1 block text-[11px] font-normal text-slate-500">3–50 characters: letters, numbers, dot, underscore, @ or hyphen.</span>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            {account ? 'New password (leave blank to keep the current one)' : 'Password'}
            <input type="text" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" spellCheck={false} placeholder="At least 8 characters" className={`${inputClass} font-mono`} />
          </label>
          {account && (
            <label className="block text-xs font-semibold text-slate-700">
              Access
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
                <option value="Active">Active — can sign in</option>
                <option value="Disabled">Disabled — cannot sign in</option>
              </select>
            </label>
          )}
          <p className="text-[11px] leading-5 text-slate-500">Resetting the password or disabling access signs this person out everywhere.</p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Close</button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : <KeyRound size={15} />}{account ? 'Save login' : 'Create login'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
