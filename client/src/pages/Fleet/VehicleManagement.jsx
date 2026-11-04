import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  ChevronDown,
  CircleDashed,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { apiFetch } from '../../auth/session';

const vehicleTypes = ['Truck', 'Trailer', 'Container', 'Pickup', 'Tempo', 'Tanker', 'Van', 'Other'];
const fuelTypes = ['Diesel', 'Petrol', 'CNG', 'LNG', 'Electric', 'Hybrid', 'Other'];
const vehicleStatuses = ['Available', 'Allocated', 'OnTrip', 'UnderMaintenance', 'Inactive'];
const manageableStatuses = ['Available', 'UnderMaintenance', 'Inactive'];
const units = ['Ton', 'KG', 'Litre'];
const emptyForm = {
  registrationNumber: '',
  vehicleType: '',
  manufacturer: '',
  model: '',
  manufacturingYear: '',
  capacityValue: '',
  capacityUnit: 'Ton',
  fuelType: '',
  ownershipType: 'Owned',
  color: '',
  chassisNumber: '',
  engineNumber: '',
  purchaseDate: '',
  notes: '',
  documents: {}
};

const vehicleDocuments = [
  ['registrationCertificate', 'Registration certificate'],
  ['insurance', 'Insurance'],
  ['fitnessCertificate', 'Fitness certificate'],
  ['pollutionCertificate', 'Pollution certificate'],
  ['nationalPermit', 'National permit']
];

// Fleet APIs require a super admin or manager login; apiFetch attaches the token.
async function vehicleRequest(path, options = {}) {
  return apiFetch(`/fleet/vehicles${path}`, options);
}

function statusTone(status) {
  if (status === 'Available') return 'bg-emerald-50 text-emerald-800 ring-emerald-600/15';
  if (status === 'OnTrip') return 'bg-sky-50 text-sky-800 ring-sky-600/15';
  if (status === 'UnderMaintenance') return 'bg-amber-50 text-amber-800 ring-amber-600/15';
  if (status === 'Inactive') return 'bg-slate-100 text-slate-600 ring-slate-500/15';
  return 'bg-violet-50 text-violet-800 ring-violet-600/15';
}

function VehicleForm({ vehicle, onClose, onSaved }) {
  const [form, setForm] = useState(() => vehicle ? {
    ...emptyForm,
    ...vehicle,
    capacityValue: vehicle.capacity?.value ?? '',
    capacityUnit: vehicle.capacity?.unit || 'Ton',
    purchaseDate: vehicle.purchaseDate ? new Date(vehicle.purchaseDate).toISOString().slice(0, 10) : '',
    documents: vehicle.documents || {}
  } : emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateDocument = (documentType, field, value) => setForm((current) => ({
    ...current,
    documents: {
      ...current.documents,
      [documentType]: {
        ...current.documents?.[documentType],
        [field]: value
      }
    }
  }));

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        registrationNumber: form.registrationNumber.trim(),
        vehicleType: form.vehicleType,
        manufacturer: form.manufacturer.trim(),
        model: form.model.trim(),
        manufacturingYear: Number(form.manufacturingYear),
        capacity: { value: Number(form.capacityValue), unit: form.capacityUnit },
        fuelType: form.fuelType,
        ownershipType: form.ownershipType,
        color: form.color,
        chassisNumber: form.chassisNumber,
        engineNumber: form.engineNumber,
        purchaseDate: form.purchaseDate ? new Date(form.purchaseDate).toISOString() : null,
        notes: form.notes,
        documents: form.documents
      };
      await vehicleRequest(vehicle ? `/${vehicle._id}` : '', {
        method: vehicle ? 'PATCH' : 'POST',
        body: payload
      });
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Fleet records</p>
            <h2 id="vehicle-form-title" className="mt-1 text-lg font-bold text-slate-900">{vehicle ? 'Edit vehicle' : 'Register vehicle'}</h2>
            <p className="mt-1 text-xs text-slate-500">Vehicle information is saved to the fleet API.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 px-5 py-5 sm:px-7">
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Registration number *
              <input required minLength={5} maxLength={20} value={form.registrationNumber} onChange={(event) => update('registrationNumber', event.target.value.toUpperCase())} placeholder="e.g. MH12AB1234" className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Vehicle type *
              <select required value={form.vehicleType} onChange={(event) => update('vehicleType', event.target.value)} className={inputClass}>
                <option value="">Select type</option>
                {vehicleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">Manufacturer *
              <input required minLength={2} maxLength={100} value={form.manufacturer} onChange={(event) => update('manufacturer', event.target.value)} placeholder="Manufacturer" className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Model *
              <input required maxLength={100} value={form.model} onChange={(event) => update('model', event.target.value)} placeholder="Model name" className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Manufacturing year *
              <input required type="number" min="1950" max={new Date().getFullYear()} value={form.manufacturingYear} onChange={(event) => update('manufacturingYear', event.target.value)} placeholder="Year" className={inputClass} />
            </label>
            <div className="grid grid-cols-[1fr_7rem] gap-2">
              <label className="text-xs font-semibold text-slate-700">Capacity *
                <input required type="number" min="0.01" step="any" value={form.capacityValue} onChange={(event) => update('capacityValue', event.target.value)} placeholder="Capacity" className={inputClass} />
              </label>
              <label className="text-xs font-semibold text-slate-700">Unit
                <select value={form.capacityUnit} onChange={(event) => update('capacityUnit', event.target.value)} className={inputClass}>
                  {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
            </div>
            <label className="text-xs font-semibold text-slate-700">Fuel type *
              <select required value={form.fuelType} onChange={(event) => update('fuelType', event.target.value)} className={inputClass}>
                <option value="">Select fuel</option>
                {fuelTypes.map((fuel) => <option key={fuel} value={fuel}>{fuel}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">Ownership
              <select value={form.ownershipType} onChange={(event) => update('ownershipType', event.target.value)} className={inputClass}>
                {['Owned', 'Leased', 'Attached'].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">Color
              <input maxLength={50} value={form.color} onChange={(event) => update('color', event.target.value)} className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Purchase date
              <input type="date" value={form.purchaseDate} onChange={(event) => update('purchaseDate', event.target.value)} className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Chassis number
              <input maxLength={100} value={form.chassisNumber} onChange={(event) => update('chassisNumber', event.target.value.toUpperCase())} className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Engine number
              <input maxLength={100} value={form.engineNumber} onChange={(event) => update('engineNumber', event.target.value.toUpperCase())} className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Notes
              <textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => update('notes', event.target.value)} className={inputClass} />
            </label>
          </div>
          <details className="rounded-xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-slate-800">Vehicle compliance documents</summary>
            <div className="space-y-4 border-t border-slate-100 p-4">
              {vehicleDocuments.map(([documentType, title]) => (
                <fieldset key={documentType} className="rounded-xl border border-slate-100 p-3">
                  <legend className="px-1 text-[11px] font-bold text-slate-700">{title}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-[11px] font-semibold text-slate-600">Document number
                      <input maxLength={100} value={form.documents?.[documentType]?.documentNumber || ''} onChange={(event) => updateDocument(documentType, 'documentNumber', event.target.value)} className={inputClass} />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600">File URL
                      <input type="url" maxLength={1000} value={form.documents?.[documentType]?.fileUrl || ''} onChange={(event) => updateDocument(documentType, 'fileUrl', event.target.value)} className={inputClass} />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600">Issue date
                      <input type="date" value={form.documents?.[documentType]?.issueDate ? new Date(form.documents[documentType].issueDate).toISOString().slice(0, 10) : ''} onChange={(event) => updateDocument(documentType, 'issueDate', event.target.value || null)} className={inputClass} />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-600">Expiry date
                      <input type="date" value={form.documents?.[documentType]?.expiryDate ? new Date(form.documents[documentType].expiryDate).toISOString().slice(0, 10) : ''} onChange={(event) => updateDocument(documentType, 'expiryDate', event.target.value || null)} className={inputClass} />
                    </label>
                  </div>
                </fieldset>
              ))}
            </div>
          </details>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60">
              {submitting ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
              {submitting ? 'Saving vehicle…' : vehicle ? 'Save changes' : 'Save vehicle'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState([]);
  const [pagination, setPagination] = useState({ totalVehicles: 0, currentPage: 1, totalPages: 0, pageLimit: 10 });
  const [search, setSearch] = useState('');
  const [vehicleStatus, setVehicleStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [busyVehicle, setBusyVehicle] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (query) params.set('search', query);
      if (vehicleStatus) params.set('vehicleStatus', vehicleStatus);
      const result = await vehicleRequest(`?${params.toString()}`);
      setVehicles(Array.isArray(result.data) ? result.data : []);
      setPagination(result.pagination || { totalVehicles: 0, currentPage: page, totalPages: 0, pageLimit: 10 });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [page, query, vehicleStatus]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  async function changeStatus(vehicle, nextStatus) {
    setBusyVehicle(vehicle._id);
    setError('');
    setNotice('');
    try {
      await vehicleRequest(`/${vehicle._id}/status`, {
        method: 'PATCH',
        body: { vehicleStatus: nextStatus }
      });
      setNotice(`Vehicle status updated to ${nextStatus}.`);
      await loadVehicles();
    } catch (requestError) {
      setError(requestError.message);
      await loadVehicles();
    } finally {
      setBusyVehicle('');
    }
  }

  async function deleteVehicle(vehicle) {
    if (!window.confirm(`Delete vehicle ${vehicle.registrationNumber}?`)) return;
    setBusyVehicle(vehicle._id);
    setError('');
    setNotice('');
    try {
      const result = await vehicleRequest(`/${vehicle._id}`, { method: 'DELETE' });
      setNotice(result.message || 'Vehicle deleted.');
      await loadVehicles();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyVehicle('');
    }
  }

  function handleSaved() {
    setShowForm(false);
    setEditingVehicle(null);
    setNotice(editingVehicle ? 'Vehicle updated successfully.' : 'Vehicle registered successfully.');
    setPage(1);
    setQuery('');
    setSearch('');
    setVehicleStatus('');
    loadVehicles();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800">
            <Car size={23} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Fleet management</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Vehicles</h1>
            <p className="mt-1 text-sm text-slate-500">Vehicle records are loaded from the fleet API.</p>
          </div>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800">
          <Plus size={16} />
          Register vehicle
        </button>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Registered vehicles</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{loading ? '—' : pagination.totalVehicles}</p>
          <p className="text-[11px] text-slate-500">Total matching live API records</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search registration, model…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="relative">
            <select value={vehicleStatus} onChange={(event) => { setVehicleStatus(event.target.value); setPage(1); }} className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-600 sm:w-48">
              <option value="">All statuses</option>
              {vehicleStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </label>
        </div>
      </section>

      {(error || notice) && (
        <div role={error ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : <Check size={15} className="mt-0.5 shrink-0" />}
          <span>{error || notice}</span>
          <button type="button" onClick={() => { setError(''); setNotice(''); }} aria-label="Dismiss message" className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Fleet records</h2>
            <p className="mt-1 text-xs text-slate-500">Search, filter and update vehicle records.</p>
          </div>
          <button type="button" onClick={loadVehicles} disabled={loading} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <CircleDashed size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5">Vehicle</th>
                <th className="px-4 py-3.5">Type & capacity</th>
                <th className="px-4 py-3.5">Powertrain</th>
                <th className="px-4 py-3.5">Ownership</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="px-5 py-14 text-center text-xs text-slate-500"><LoaderCircle size={18} className="mx-auto mb-2 animate-spin text-emerald-700" />Loading live vehicle records…</td></tr>
              ) : error && vehicles.length === 0 ? (
                <tr><td colSpan="6" className="px-5 py-14 text-center text-xs text-slate-500">Vehicle records could not be loaded. Check the API connection and retry.</td></tr>
              ) : vehicles.length === 0 ? (
                <tr><td colSpan="6" className="px-5 py-14 text-center">
                  <Car size={22} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">No vehicles found</p>
                  <p className="mt-1 text-xs text-slate-500">{query || vehicleStatus ? 'Try another search or status filter.' : 'Register a vehicle to start building your fleet records.'}</p>
                </td></tr>
              ) : vehicles.map((vehicle) => (
                <tr key={vehicle._id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <p className="text-xs font-bold text-slate-900">{vehicle.registrationNumber}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{vehicle.manufacturer} {vehicle.model} · {vehicle.manufacturingYear}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-xs font-semibold text-slate-800">{vehicle.vehicleType}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{vehicle.capacity?.value ?? '—'} {vehicle.capacity?.unit || ''}</p>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-700">{vehicle.fuelType || '—'}</td>
                  <td className="px-4 py-4 text-xs text-slate-700">{vehicle.ownershipType || '—'}</td>
                  <td className="px-4 py-4">
                    <label className="sr-only" htmlFor={`status-${vehicle._id}`}>Status for {vehicle.registrationNumber}</label>
                    <select id={`status-${vehicle._id}`} value={vehicle.vehicleStatus} disabled={busyVehicle === vehicle._id || ['Allocated', 'OnTrip'].includes(vehicle.vehicleStatus)} onChange={(event) => changeStatus(vehicle, event.target.value)} className={`max-w-44 rounded-full px-2.5 py-1.5 text-[10px] font-bold ring-1 ring-inset outline-none disabled:opacity-50 ${statusTone(vehicle.vehicleStatus)}`}>
                      {[vehicle.vehicleStatus, ...manageableStatuses].filter((status, index, list) => list.indexOf(status) === index).map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => { setEditingVehicle(vehicle); setShowForm(true); }} disabled={busyVehicle === vehicle._id} className="rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">Edit</button>
                      <button type="button" onClick={() => deleteVehicle(vehicle)} disabled={busyVehicle === vehicle._id || ['Allocated', 'OnTrip'].includes(vehicle.vehicleStatus)} title={['Allocated', 'OnTrip'].includes(vehicle.vehicleStatus) ? 'Allocated or in-trip vehicles cannot be deleted' : 'Soft delete vehicle'} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40">
                        {busyVehicle === vehicle._id ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-500">
            {pagination.totalVehicles ? `Page ${pagination.currentPage} of ${pagination.totalPages} · ${pagination.totalVehicles} matching vehicles` : 'No matching vehicles'}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <ArrowLeft size={13} />Previous
            </button>
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={loading || page >= pagination.totalPages} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Next<ArrowRight size={13} />
            </button>
          </div>
        </div>
      </section>

      {showForm && <VehicleForm vehicle={editingVehicle} onClose={() => { setShowForm(false); setEditingVehicle(null); }} onSaved={handleSaved} />}
    </div>
  );
}
