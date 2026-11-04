import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, LoaderCircle, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { panelOptions } from '../../config/navigation';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 font-sans sm:py-16">
      <section className="mx-auto grid max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-[#102c27] p-7 text-white sm:p-10">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400 text-sm font-black text-[#102c27]">T</div>
            <div>
              <p className="text-sm font-bold">Transport CRM</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/60">Operations workspace</p>
            </div>
          </div>
          <p className="mt-10 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">One login for every role</p>
          <ul className="mt-4 space-y-3">
            {panelOptions.map((panel) => (
              <li key={panel.value} className="text-sm leading-5">
                <span className="font-semibold text-white">{panel.title}</span>
                <span className="block text-xs text-slate-300">{panel.description}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 sm:p-9">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}

function Alert({ tone = 'error', children }) {
  if (!children) return null;
  const tones = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${tones}`}>
      <AlertCircle size={16} className="mt-0.5 shrink-0" />{children}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-500 hover:text-slate-800"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function LoginPage() {
  const { login, notice, clearNotice } = useAuth();
  const location = useLocation();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!selectedRole || !loginId.trim() || !password) {
      setError('Select a panel and enter your login ID and password.');
      return;
    }
    setBusy(true); setError(''); clearNotice();
    try {
      await login(loginId.trim(), password, selectedRole);
    } catch (requestError) {
      setError(requestError.message);
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Choose your panel, then sign in with the login ID and password for that account.">
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Alert tone="notice">{notice}</Alert>
        <Alert>{error}</Alert>
        <label className="block" htmlFor="login-role">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Select panel</span>
          <select
            id="login-role"
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value)}
            className={inputClass}
          >
            <option value="">Choose your panel</option>
            {panelOptions.map((panel) => (
              <option key={panel.value} value={panel.value}>{panel.label}</option>
            ))}
          </select>
        </label>
        <label className="block" htmlFor="login-id">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Login ID</span>
          <input
            id="login-id"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block" htmlFor="password">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Password</span>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </label>
        <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <LogIn size={16} />}Sign in
        </button>
        <p className="text-xs leading-5 text-slate-500">
          Forgot your password? Ask your administrator to reset it.
        </p>
        <div className="border-t border-slate-100 pt-4 text-sm text-slate-600">
          New customer?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-emerald-800 hover:text-emerald-950">Create a customer account</Link>
        </div>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { registerCustomer } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ contactPerson: '', companyName: '', phone: '', password: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    const phone = form.phone.replace(/[\s-]/g, '');
    if (form.contactPerson.trim().length < 2) return setError('Enter your name.');
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit mobile number.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');

    setBusy(true); setError('');
    try {
      await registerCustomer({
        contactPerson: form.contactPerson.trim(),
        companyName: form.companyName.trim(),
        phone,
        password: form.password
      });
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  const textField = (field, label, props = {}) => (
    <label className="block" htmlFor={`register-${field}`}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>
      <input id={`register-${field}`} value={form[field]} onChange={(event) => update(field)(event.target.value)} className={inputClass} {...props} />
    </label>
  );

  return (
    <AuthShell title="Create a customer account" subtitle="Your mobile number becomes your login ID.">
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Alert>{error}</Alert>
        {textField('contactPerson', 'Your name', { autoComplete: 'name', autoFocus: true })}
        {textField('companyName', 'Company name (optional)', { autoComplete: 'organization' })}
        {textField('phone', 'Mobile number', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '9876543210' })}
        <label className="block" htmlFor="register-password">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Password (8+ characters)</span>
          <PasswordInput id="register-password" value={form.password} onChange={update('password')} autoComplete="new-password" />
        </label>
        <label className="block" htmlFor="register-confirm">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Confirm password</span>
          <PasswordInput id="register-confirm" value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" />
        </label>
        <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <UserPlus size={16} />}Create account
        </button>
        <div className="border-t border-slate-100 pt-4 text-sm text-slate-600">
          Already have a login?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-emerald-800 hover:text-emerald-950">Sign in</Link>
        </div>
      </form>
    </AuthShell>
  );
}
