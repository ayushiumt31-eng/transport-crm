import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, BriefcaseBusiness, Eye, EyeOff, LoaderCircle, LogIn, ShieldCheck, Truck, UserPlus, UserRound } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { panelOptions } from '../../config/navigation';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100';
const panelIcons = {
  admin: ShieldCheck,
  manager: BriefcaseBusiness,
  driver: Truck,
  customer: UserRound
};

function AuthShell({ title, subtitle, children, onBack }) {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 font-sans sm:py-14">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
        <div className="p-6 sm:p-10">
          <div className="mb-7 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-xs font-black text-white">T</span>
            <div>
              <p className="text-sm font-bold text-slate-900">Transport CRM</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Operations workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to all panels"
                title="Back to all panels"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
          </div>
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
  const isCustomerPanel = selectedRole === 'customer';
  const selectedPanel = panelOptions.find((panel) => panel.value === selectedRole);

  function backToPanels() {
    setSelectedRole('');
    setLoginId('');
    setPassword('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!selectedRole || !loginId.trim() || !password) {
      setError('Select a panel and enter your email or login ID and password.');
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
    <AuthShell
      title={selectedPanel ? `Sign in to ${selectedPanel.title}` : 'Choose your panel'}
      subtitle={selectedPanel ? 'Enter the login details for this panel.' : 'Select a panel to continue to its secure login.'}
      onBack={selectedRole ? backToPanels : undefined}
    >
      {!selectedRole && <section aria-label="Choose a panel" className="mt-6 space-y-3">
        {panelOptions.map((panel) => {
          const Icon = panelIcons[panel.value];
          const isSelected = selectedRole === panel.value;
          return (
            <div key={panel.value} className={`rounded-xl border transition ${isSelected ? 'border-blue-700 bg-blue-50/50' : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50'}`}>
              <button
                type="button"
                onClick={() => { setSelectedRole(panel.value); setError(''); }}
                aria-pressed={isSelected}
                className="flex w-full items-center gap-4 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 sm:px-5"
              >
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${isSelected ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}><Icon size={21} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{panel.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">{panel.description}</span>
                </span>
                <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${isSelected ? 'text-blue-800' : 'text-slate-600'}`}>
                  {isSelected ? 'Selected' : 'Choose'} <ArrowRight size={15} />
                </span>
              </button>
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 sm:px-5">
                <span className="text-[11px] text-slate-500">{panel.value === 'customer' ? 'Already registered? Sign in above.' : 'Account access is provided by your organization.'}</span>
                {panel.value === 'customer' && (
                  <Link to="/register" state={location.state} className="shrink-0 text-xs font-semibold text-blue-800 hover:text-blue-950">
                    Create account
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </section>}
      {selectedRole && <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Alert tone="notice">{notice}</Alert>
        <Alert>{error}</Alert>
        <p className="text-xs font-semibold text-slate-700">Signing in to {panelOptions.find((panel) => panel.value === selectedRole)?.title}</p>
        <label className="block" htmlFor="login-id">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">{isCustomerPanel ? 'Email address' : 'Email address / Login ID'}</span>
          <input
            id="login-id"
            type={isCustomerPanel ? 'email' : 'text'}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            placeholder={isCustomerPanel ? 'you@example.com' : ''}
            className={inputClass}
          />
        </label>
        <label className="block" htmlFor="password">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Password</span>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </label>
        <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <LogIn size={16} />}Sign in
        </button>
        <p className="text-xs leading-5 text-slate-500">
          {isCustomerPanel
            ? 'Use the email address and password you chose when registering.'
            : 'Forgot your password? Ask your administrator to reset it.'}
        </p>
        {isCustomerPanel && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
          Don’t have a customer login?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-blue-800 hover:text-blue-950">Create a customer account</Link>
        </div>}
      </form>}
    </AuthShell>
  );
}

export function RegisterPage() {
  const { registerCustomer } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ contactPerson: '', companyName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    const phone = form.phone.replace(/[\s-]/g, '');
    const email = form.email.trim().toLowerCase();
    if (form.contactPerson.trim().length < 2) return setError('Enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Enter a valid email address.');
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit mobile number.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');

    setBusy(true); setError('');
    try {
      await registerCustomer({
        contactPerson: form.contactPerson.trim(),
        companyName: form.companyName.trim(),
        email,
        phone,
        password: form.password
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
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
    <AuthShell title="Create a customer account" subtitle="Create your account with an email address and password.">
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Alert>{error}</Alert>
        {textField('contactPerson', 'Your name', { autoComplete: 'name', autoFocus: true })}
        {textField('companyName', 'Company name (optional)', { autoComplete: 'organization' })}
        {textField('email', 'Email address', { type: 'email', autoComplete: 'email', autoCapitalize: 'none' })}
        <label className="block" htmlFor="register-phone">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Mobile number (for contact)</span>
          <input
            id="register-phone"
            value={form.phone}
            onChange={(event) => update('phone')(event.target.value)}
            className={inputClass}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="9876543210"
          />
        </label>
        <label className="block" htmlFor="register-password">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Password (8+ characters)</span>
          <PasswordInput id="register-password" value={form.password} onChange={update('password')} autoComplete="new-password" />
        </label>
        <label className="block" htmlFor="register-confirm">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Confirm password</span>
          <PasswordInput id="register-confirm" value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" />
        </label>
        <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <UserPlus size={16} />}Create account
        </button>
        <div className="border-t border-slate-100 pt-4 text-sm text-slate-600">
          Already have a login?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-blue-800 hover:text-blue-950">Sign in</Link>
        </div>
      </form>
    </AuthShell>
  );
}
