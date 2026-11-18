import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, Plus, Receipt, Save, Trash2 } from 'lucide-react';
import { apiFetch } from '../../auth/session';
import { useAuth } from '../../auth/AuthContext';

const states = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const emptyProfile = {
  legalName: '',
  gstin: '',
  registeredState: '',
  billingAddress: { line1: '', line2: '', city: '', pincode: '', country: 'India' },
  taxCategories: [],
  taxRatesReviewed: false,
  profileComplete: false,
  missingFields: []
};

async function gstRequest(path, options) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

export default function GstSettings() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProfile({ ...emptyProfile, ...(await gstRequest('/billing/gst-profile')) });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  function updateAddress(field, value) {
    setProfile((current) => ({
      ...current,
      billingAddress: { ...current.billingAddress, [field]: value }
    }));
  }

  function updateCategory(index, field, value) {
    setProfile((current) => ({
      ...current,
      taxCategories: current.taxCategories.map((category, itemIndex) => (
        itemIndex === index ? { ...category, [field]: value } : category
      ))
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await gstRequest('/billing/gst-profile', {
        method: 'PUT',
        body: {
          legalName: profile.legalName,
          gstin: profile.gstin,
          registeredState: profile.registeredState,
          billingAddress: profile.billingAddress,
          taxCategories: profile.taxCategories.map((category) => ({
            name: category.name,
            serviceCode: category.serviceCode,
            ratePercent: Number(category.ratePercent)
          })),
          taxRatesReviewed: profile.taxRatesReviewed
        }
      });
      setProfile({ ...emptyProfile, ...saved });
      setNotice('GST profile saved. Verify all details with your tax advisor before using them on invoices.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500';

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Receipt size={22} /></div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Billing & accounting</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">GST business profile <span className="text-sm font-semibold text-slate-500">(optional)</span></h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Configure seller details and CA-confirmed tax categories only if your business needs them.</p>
        </div>
      </header>

      <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
        GST setup is optional and is not required for the existing internal invoice and payment workflow. This screen only stores setup details; it does not generate GST tax invoices or e-invoices. Enter tax codes and rates only after confirmation by your CA/tax advisor. GSTIN, tax classification, place-of-supply rules, IRN and GSTN verification are not validated here.
      </div>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><Check size={15} />{notice}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" />Loading GST profile…</div>
      ) : (
        <form onSubmit={saveProfile} className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">Registered business details</h2>
              <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${profile.profileComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                {profile.profileComplete ? 'Configured' : 'Not configured (optional)'}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">Legal business name<input value={profile.legalName} onChange={(event) => setProfile((current) => ({ ...current, legalName: event.target.value }))} maxLength={150} className={inputClass} disabled={!isAdmin} /></label>
              <label className="text-xs font-semibold text-slate-600">GSTIN<input value={profile.gstin} onChange={(event) => setProfile((current) => ({ ...current, gstin: event.target.value.toUpperCase() }))} maxLength={15} pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]" className={inputClass} disabled={!isAdmin} /></label>
              <label className="text-xs font-semibold text-slate-600">GST registration state<select value={profile.registeredState} onChange={(event) => setProfile((current) => ({ ...current, registeredState: event.target.value }))} className={inputClass} disabled={!isAdmin}><option value="">Select a state or territory</option>{states.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
              <label className="text-xs font-semibold text-slate-600">Billing address<input value={profile.billingAddress.line1} onChange={(event) => updateAddress('line1', event.target.value)} maxLength={200} className={inputClass} disabled={!isAdmin} /></label>
              <label className="text-xs font-semibold text-slate-600">Address line 2<input value={profile.billingAddress.line2} onChange={(event) => updateAddress('line2', event.target.value)} maxLength={200} className={inputClass} disabled={!isAdmin} /></label>
              <label className="text-xs font-semibold text-slate-600">City<input value={profile.billingAddress.city} onChange={(event) => updateAddress('city', event.target.value)} maxLength={100} className={inputClass} disabled={!isAdmin} /></label>
              <label className="text-xs font-semibold text-slate-600">PIN code<input value={profile.billingAddress.pincode} onChange={(event) => updateAddress('pincode', event.target.value)} maxLength={10} className={inputClass} disabled={!isAdmin} /></label>
              <label className="text-xs font-semibold text-slate-600">Country<input value={profile.billingAddress.country} onChange={(event) => updateAddress('country', event.target.value)} maxLength={80} className={inputClass} disabled={!isAdmin} /></label>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">CA-confirmed service tax categories</h2>
                <p className="mt-1 text-xs text-slate-500">Enter one row per applicable service classification.</p>
              </div>
              {isAdmin && <button type="button" disabled={profile.taxCategories.length >= 50} onClick={() => setProfile((current) => ({ ...current, taxCategories: [...current.taxCategories, { name: '', serviceCode: '', ratePercent: '' }] }))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><Plus size={14} />Add category</button>}
            </div>
            {profile.taxCategories.length === 0 && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No tax categories added.</p>}
            {profile.taxCategories.map((category, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-[1fr_0.7fr_0.5fr_auto] sm:items-end">
                <label className="text-xs font-semibold text-slate-600">Service category<input value={category.name} onChange={(event) => updateCategory(index, 'name', event.target.value)} minLength={2} maxLength={120} className={inputClass} disabled={!isAdmin} /></label>
                <label className="text-xs font-semibold text-slate-600">HSN/SAC code<input value={category.serviceCode} onChange={(event) => updateCategory(index, 'serviceCode', event.target.value.toUpperCase())} minLength={4} maxLength={8} pattern="[A-Z0-9]{4,8}" className={inputClass} disabled={!isAdmin} /></label>
                <label className="text-xs font-semibold text-slate-600">GST rate (%)<input type="number" min="0" max="100" step="0.01" value={category.ratePercent} onChange={(event) => updateCategory(index, 'ratePercent', event.target.value)} className={inputClass} disabled={!isAdmin} /></label>
                {isAdmin && <button type="button" aria-label={`Remove tax category ${index + 1}`} onClick={() => setProfile((current) => ({ ...current, taxCategories: current.taxCategories.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"><Trash2 size={15} /></button>}
              </div>
            ))}
            <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">
              <input type="checkbox" checked={profile.taxRatesReviewed} onChange={(event) => setProfile((current) => ({ ...current, taxRatesReviewed: event.target.checked }))} disabled={!isAdmin} className="mt-1 accent-emerald-700" />
              <span>I confirm these service codes and rates have been reviewed by our CA/tax advisor. Leave unchecked until confirmed.</span>
            </label>
          </section>

          {!isAdmin && <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">Only a Super Admin can change the GST profile.</p>}
          {isAdmin && <div className="flex justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}Save GST profile</button></div>}
        </form>
      )}
    </div>
  );
}
