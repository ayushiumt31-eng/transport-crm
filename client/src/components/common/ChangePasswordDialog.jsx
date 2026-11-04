import React, { useState } from 'react';
import { AlertCircle, Check, KeyRound, LoaderCircle, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Modal } from './LoginAccessDialog';

const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

export default function ChangePasswordDialog({ onClose }) {
  const { changePassword, user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (!form.currentPassword) return setError('Enter your current password.');
    if (form.newPassword.length < 8) return setError('The new password must be at least 8 characters.');
    if (form.newPassword !== form.confirmPassword) return setError('New passwords do not match.');
    setBusy(true); setError('');
    try {
      setDone(await changePassword(form.currentPassword, form.newPassword));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal titleId="change-password-title" onClose={onClose}>
      <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Account</p>
          <h2 id="change-password-title" className="mt-1 text-lg font-bold text-slate-900">Change password</h2>
          {user?.loginId && <p className="mt-1 text-xs text-slate-500">Login ID: <span className="font-mono">{user.loginId}</span></p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </header>
      {done ? (
        <div className="space-y-4 px-5 py-5">
          <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={16} className="mt-0.5 shrink-0" />{done}</div>
          <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800">Done</button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 px-5 py-5" noValidate>
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
          <label className="block text-xs font-semibold text-slate-700">Current password
            <input type="password" autoComplete="current-password" value={form.currentPassword} onChange={update('currentPassword')} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-slate-700">New password (8+ characters)
            <input type="password" autoComplete="new-password" value={form.newPassword} onChange={update('newPassword')} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-slate-700">Confirm new password
            <input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update('confirmPassword')} className={inputClass} />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : <KeyRound size={15} />}Change password
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
