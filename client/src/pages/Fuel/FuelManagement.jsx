import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Fuel, Gauge, LoaderCircle, Plus, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { apiFetch } from '../../auth/session';
import { useAuth } from '../../auth/AuthContext';

const pageDetails = {
  '/fuel/entry': {
    title: 'Fuel entry',
    description: 'Record a vehicle refuelling transaction with odometer and receipt details.'
  },
  '/fuel/consumption': {
    title: 'Fuel consumption',
    description: 'Review recorded fuel quantities and purchase costs by vehicle and date.'
  },
  '/fuel/mileage': {
    title: 'Mileage tracking',
    description: 'Compare odometer distance with fuel purchased between full-tank entries.'
  },
  '/fuel/cost-analysis': {
    title: 'Fuel cost analysis',
    description: 'Analyze fuel spend, quantities and operating cost by vehicle.'
  },
  '/reports/fuel': {
    title: 'Fuel reports',
    description: 'Review fuel costs, usage and full-tank mileage across the fleet.'
  }
};

const allUnits = ['Litre', 'Kg', 'KWh'];

async function fuelRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

function localDateTimeValue(value = new Date()) {
  const adjusted = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function rupees(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise || 0) / 100);
}

function quantity(value, digits = 3) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(Number(value || 0));
}

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function unitForFuelType(fuelType) {
  if (['Diesel', 'Petrol', 'Hybrid'].includes(fuelType)) return 'Litre';
  if (['CNG', 'LNG'].includes(fuelType)) return 'Kg';
  if (fuelType === 'Electric') return 'KWh';
  return '';
}

function initialDraft() {
  return {
    idempotencyKey: window.crypto.randomUUID(),
    vehicleId: '',
    tripId: '',
    filledAt: localDateTimeValue(),
    quantity: '',
    unit: 'Litre',
    pricePerUnit: '',
    odometerKm: '',
    isFullTank: false,
    vendor: '',
    receiptNumber: '',
    notes: ''
  };
}

function FuelManagement({ path }) {
  const page = pageDetails[path] || pageDetails['/fuel/entry'];
  const { role } = useAuth();
  const isStaff = role === 'admin' || role === 'manager';
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [draft, setDraft] = useState(initialDraft);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [filterVehicleId, setFilterVehicleId] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedVehicle = vehicles.find((vehicle) => vehicle._id === draft.vehicleId);
  const requiredUnit = unitForFuelType(selectedVehicle?.fuelType);
  const units = requiredUnit ? [requiredUnit] : allUnits;

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(pageNumber), limit: '20' });
    if (search.trim()) params.set('search', search.trim());
    if (filterVehicleId) params.set('vehicleId', filterVehicleId);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params.toString();
  }, [pageNumber, search, filterVehicleId, startDate, endDate]);

  const summaryQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (filterVehicleId) params.set('vehicleId', filterVehicleId);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params.toString();
  }, [filterVehicleId, startDate, endDate]);

  const loadData = useCallback(async () => {
    if (!isStaff) return;
    setLoading(true);
    setError('');
    try {
      const [entryResult, summaryResult] = await Promise.all([
        fuelRequest(`/fuel/entries?${query}`),
        fuelRequest(`/fuel/reports/summary${summaryQuery ? `?${summaryQuery}` : ''}`)
      ]);
      setEntries(entryResult.data || []);
      setPagination(entryResult.pagination || { total: 0, page: pageNumber, limit: 20, totalPages: 0 });
      setSummary(summaryResult);
    } catch (requestError) {
      setEntries([]);
      setPagination({ total: 0, page: pageNumber, limit: 20, totalPages: 0 });
      setSummary(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [isStaff, pageNumber, query, summaryQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isStaff) return undefined;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: '1', limit: '100' });
        if (vehicleSearch.trim()) params.set('search', vehicleSearch.trim());
        const result = await fuelRequest(`/fuel/options/vehicles?${params}`);
        setVehicles(result.data || []);
      } catch (requestError) {
        setError(requestError.message);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [isStaff, vehicleSearch]);

  useEffect(() => {
    if (!draft.vehicleId) {
      setTrips([]);
      return;
    }
    let active = true;
    fuelRequest(`/fuel/options/trips?vehicleId=${encodeURIComponent(draft.vehicleId)}`)
      .then((result) => {
        if (active) setTrips(result || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => { active = false; };
  }, [draft.vehicleId]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value, idempotencyKey: window.crypto.randomUUID() }));
  }

  async function createEntry(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await fuelRequest('/fuel/entries', {
        method: 'POST',
        body: {
          ...draft,
          tripId: draft.tripId || undefined,
          filledAt: new Date(draft.filledAt).toISOString(),
          quantity: Number(draft.quantity),
          pricePerUnit: Number(draft.pricePerUnit),
          odometerKm: Number(draft.odometerKm)
        }
      });
      setNotice(`Fuel entry recorded for ${result.vehicleId?.registrationNumber || selectedVehicle?.registrationNumber || 'the vehicle'}.`);
      setVehicles((current) => current.map((vehicle) => vehicle._id === draft.vehicleId
        ? { ...vehicle, lastFuelOdometerKm: result.odometerKm }
        : vehicle));
      setDraft(initialDraft());
      if (pageNumber === 1) await loadData();
      else setPageNumber(1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

  if (!isStaff) {
    return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Fuel records are available to staff only.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Fuel size={22} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Fuel management</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{page.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{page.description}</p>
          </div>
        </div>
        <button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><Check size={15} />{notice}</div>}

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <label className="relative min-w-0 flex-1 text-[10px] font-semibold text-slate-500">
          <span className="mb-1 block">Search fuel entries</span>
          <Search size={14} className="absolute bottom-3 left-3 text-slate-400" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPageNumber(1); }} className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-emerald-600" placeholder="Vendor, receipt, notes…" />
        </label>
        <label className="text-[10px] font-semibold text-slate-500"><span className="mb-1 block">From</span><input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPageNumber(1); }} className={inputClass} /></label>
        <label className="text-[10px] font-semibold text-slate-500"><span className="mb-1 block">To</span><input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPageNumber(1); }} className={inputClass} /></label>
        <label className="min-w-48 text-[10px] font-semibold text-slate-500"><span className="mb-1 block">Find vehicle</span><input value={vehicleSearch} onChange={(event) => setVehicleSearch(event.target.value)} placeholder="Registration or model" className={inputClass} /></label>
        <label className="min-w-52 text-[10px] font-semibold text-slate-500">
          <span className="mb-1 block">Filter vehicle</span>
          <select value={filterVehicleId} onChange={(event) => { setFilterVehicleId(event.target.value); setPageNumber(1); }} className={inputClass}>
            <option value="">All vehicles</option>
            {vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.registrationNumber} · {vehicle.fuelType}</option>)}
          </select>
        </label>
      </section>

      {path === '/fuel/entry' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Plus size={16} className="text-emerald-700" /><h2 className="text-sm font-bold text-slate-900">Record a fuel purchase</h2></div>
          <form onSubmit={createEntry} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-[10px] font-semibold text-slate-600">Vehicle<select required value={draft.vehicleId} onChange={(event) => {
              const nextVehicle = vehicles.find((vehicle) => vehicle._id === event.target.value);
              setDraft((current) => ({
                ...current,
                vehicleId: event.target.value,
                tripId: '',
                odometerKm: nextVehicle?.lastFuelOdometerKm == null ? '' : String(nextVehicle.lastFuelOdometerKm),
                unit: unitForFuelType(nextVehicle?.fuelType) || 'Litre',
                idempotencyKey: window.crypto.randomUUID()
              }));
            }} className={inputClass}><option value="">Select a vehicle</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.registrationNumber} · {vehicle.fuelType}</option>)}</select></label>
            <label className="text-[10px] font-semibold text-slate-600">Trip (optional)<select value={draft.tripId} onChange={(event) => updateDraft('tripId', event.target.value)} disabled={!draft.vehicleId} className={inputClass}><option value="">No trip linked</option>{trips.map((trip) => <option key={trip._id} value={trip._id}>{trip.tripNumber} · {trip.tripStatus}</option>)}</select></label>
            <label className="text-[10px] font-semibold text-slate-600">Fill date and time<input required type="datetime-local" value={draft.filledAt} onChange={(event) => updateDraft('filledAt', event.target.value)} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Quantity<input required type="number" min="0.001" max="1000000" step="0.001" value={draft.quantity} onChange={(event) => updateDraft('quantity', event.target.value)} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Unit<select required value={draft.unit} onChange={(event) => updateDraft('unit', event.target.value)} className={inputClass}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
            <label className="text-[10px] font-semibold text-slate-600">Price per unit (INR)<input required type="number" min="0.01" max="1000000" step="0.01" value={draft.pricePerUnit} onChange={(event) => updateDraft('pricePerUnit', event.target.value)} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Odometer (km)<input required type="number" min={selectedVehicle?.lastFuelOdometerKm == null ? 0 : selectedVehicle.lastFuelOdometerKm + 1} max="100000000" step="1" value={draft.odometerKm} onChange={(event) => updateDraft('odometerKm', event.target.value)} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Fuel station / vendor<input maxLength="150" value={draft.vendor} onChange={(event) => updateDraft('vendor', event.target.value)} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Receipt number<input maxLength="100" value={draft.receiptNumber} onChange={(event) => updateDraft('receiptNumber', event.target.value)} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600 sm:col-span-2">Notes<input maxLength="500" value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} className={inputClass} /></label>
            <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-700"><input type="checkbox" checked={draft.isFullTank} onChange={(event) => updateDraft('isFullTank', event.target.checked)} className="accent-emerald-700" />Full tank (used for mileage)</label>
            <div className="flex items-end sm:col-span-2 xl:col-span-4">
              <button type="submit" disabled={saving || !draft.vehicleId} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}Record fuel entry</button>
            </div>
          </form>
          <p className="mt-3 text-[10px] leading-5 text-slate-500">Fuel entries are staff-only and cannot be edited or deleted. Odometer readings and fill times must move forward. Mileage is computed only after two full-tank entries.</p>
        </section>
      )}

      {summary && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Fuel entries', summary.entryCount],
            ['Fuel spend', rupees(summary.totalCostPaise)],
            ...summary.quantityByUnit.map((item) => [`Quantity (${item.unit})`, quantity(item.quantity)]),
            ['Mileage intervals', summary.mileage.reduce((total, item) => total + item.intervalCount, 0)]
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">{value}</p></div>)}
        </section>
      )}

      {path !== '/fuel/entry' && path !== '/fuel/mileage' && summary?.byVehicle?.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-bold text-slate-900">Cost by vehicle</h2></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Entries</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Fuel cost</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{summary.byVehicle.map((item) => <tr key={`${item.vehicle?._id}-${item.unit}`}><td className="px-4 py-3 font-semibold text-slate-800">{item.vehicle?.registrationNumber || 'Vehicle unavailable'}</td><td className="px-4 py-3">{item.entryCount}</td><td className="px-4 py-3">{quantity(item.quantity)} {item.unit}</td><td className="px-4 py-3 font-semibold">{rupees(item.totalCostPaise)}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}

      {(path === '/fuel/mileage' || path === '/reports/fuel') && summary?.mileage?.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3"><TrendingUp size={15} className="text-emerald-700" /><h2 className="text-sm font-bold text-slate-900">Full-tank mileage</h2></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Intervals</th><th className="px-4 py-3">Distance</th><th className="px-4 py-3">Fuel added</th><th className="px-4 py-3">Average mileage</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{summary.mileage.map((item) => <tr key={`${item.vehicle?._id}-${item.unit}`}><td className="px-4 py-3 font-semibold text-slate-800">{item.vehicle?.registrationNumber || 'Vehicle unavailable'}</td><td className="px-4 py-3">{item.intervalCount}</td><td className="px-4 py-3">{quantity(item.distanceKm, 0)} km</td><td className="px-4 py-3">{quantity(item.fuelQuantity)} {item.unit}</td><td className="px-4 py-3 font-semibold">{quantity(item.mileageKmPerUnit)} km/{item.unit}</td></tr>)}</tbody>
          </table></div>
          <p className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500">Intervals use the distance between full-tank fills and include all recorded fuel purchases after the previous full tank.</p>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3"><Gauge size={15} className="text-emerald-700" /><h2 className="text-sm font-bold text-slate-900">Fuel ledger</h2></div>
        {loading ? <div className="flex items-center justify-center gap-2 p-10 text-xs text-slate-500"><LoaderCircle size={16} className="animate-spin" />Loading fuel records…</div> : entries.length === 0 ? <p className="p-8 text-center text-xs text-slate-500">No fuel entries match these filters.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Filled at</th><th className="px-4 py-3">Vehicle / trip</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Odometer</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Mileage</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{entries.map((entry) => <tr key={entry._id}>
              <td className="px-4 py-3">{dateTime(entry.filledAt)}{entry.isFullTank && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-800">Full tank</span>}</td>
              <td className="px-4 py-3"><strong>{entry.vehicleId?.registrationNumber || 'Vehicle unavailable'}</strong><div className="mt-1 text-[10px] text-slate-500">{entry.tripId?.tripNumber || entry.vendor || '—'}</div></td>
              <td className="px-4 py-3">{quantity(entry.quantity)} {entry.unit}<div className="mt-1 text-[10px] text-slate-500">{rupees(entry.pricePerUnitPaise)}/{entry.unit}</div></td>
              <td className="px-4 py-3">{quantity(entry.odometerKm, 0)} km</td>
              <td className="px-4 py-3 font-semibold">{rupees(entry.totalCostPaise)}</td>
              <td className="px-4 py-3">{entry.mileageKmPerUnit == null ? '—' : `${quantity(entry.mileageKmPerUnit)} km/${entry.unit}`}</td>
            </tr>)}</tbody>
          </table></div>
        )}
        {pagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500"><span>{pagination.total} entries · Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2"><button type="button" disabled={pageNumber <= 1 || loading} onClick={() => setPageNumber((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={pageNumber >= pagination.totalPages || loading} onClick={() => setPageNumber((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Next</button></div></div>}
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">
        Mileage depends on accurate manual odometer and full-tank entries. It is not a GPS/fuel-sensor reading; station, card, and accounting-system integrations are not connected.
      </div>
    </div>
  );
}

export default FuelManagement;
