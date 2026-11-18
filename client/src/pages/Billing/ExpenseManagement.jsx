import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Download, LoaderCircle, Plus, Receipt, RefreshCw, Search, X } from 'lucide-react';
import { apiFetch } from '../../auth/session';

const categories = ['Fuel', 'Toll', 'Maintenance', 'Driver', 'Operations', 'Other'];

async function expenseRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

function localDate(value = new Date()) {
  const adjusted = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function rupees(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise || 0) / 100);
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function ExpenseForm({ vehicles, trips, onClose, onSubmit, saving }) {
  const [draft, setDraft] = useState(() => ({
    idempotencyKey: window.crypto.randomUUID(),
    category: 'Operations',
    description: '',
    amount: '',
    incurredAt: localDate(),
    vehicleId: '',
    tripId: '',
    vendor: '',
    reference: '',
    notes: ''
  }));
  const [formError, setFormError] = useState('');
  const selectedTrip = trips.find((trip) => trip._id === draft.tripId);
  const selectedVehicleId = selectedTrip?.vehicleId?._id || selectedTrip?.vehicleId || draft.vehicleId;

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    try {
      await onSubmit({
        ...draft,
        amount: Number(draft.amount),
        incurredAt: new Date(`${draft.incurredAt}T12:00:00.000Z`).toISOString(),
        vehicleId: selectedVehicleId || undefined,
        tripId: draft.tripId || undefined
      });
    } catch (error) {
      setFormError(error.message);
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="expense-form-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-100 p-5">
        <div><h2 id="expense-form-title" className="text-lg font-bold text-slate-950">Record expense</h2><p className="mt-1 text-xs text-slate-500">Saved as a financial record with creator and timestamp audit fields.</p></div>
        <button type="button" onClick={onClose} aria-label="Close expense form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </header>
      <form onSubmit={submit} className="space-y-4 p-5">
        {formError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{formError}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">Category<select required value={draft.category} onChange={(event) => update('category', event.target.value)} className={inputClass}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">Amount (INR)<input required type="number" min="0.01" max="90071992547409.9" step="0.01" value={draft.amount} onChange={(event) => update('amount', event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Description<input required minLength={2} maxLength={500} value={draft.description} onChange={(event) => update('description', event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-semibold text-slate-700">Expense date<input required type="date" max={localDate()} value={draft.incurredAt} onChange={(event) => update('incurredAt', event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-semibold text-slate-700">Trip (optional)<select value={draft.tripId} onChange={(event) => update('tripId', event.target.value)} className={inputClass}><option value="">No trip linked</option>{trips.map((trip) => <option key={trip._id} value={trip._id}>{trip.tripNumber} · {trip.tripStatus}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">Vehicle (optional)<select disabled={Boolean(selectedTrip)} value={selectedVehicleId} onChange={(event) => update('vehicleId', event.target.value)} className={`${inputClass} disabled:bg-slate-100`}><option value="">No vehicle linked</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.registrationNumber} · {vehicle.vehicleType}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">Vendor<input maxLength={150} value={draft.vendor} onChange={(event) => update('vendor', event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-semibold text-slate-700">Receipt / reference<input maxLength={100} value={draft.reference} onChange={(event) => update('reference', event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Notes<textarea rows={3} maxLength={1000} value={draft.notes} onChange={(event) => update('notes', event.target.value)} className={inputClass} /></label>
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">This manual expense ledger is separate from Fuel and Maintenance records. Avoid recording the same transaction in multiple ledgers, or it may be double-counted in combined accounting.</p>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Save expense</button>
        </div>
      </form>
    </section>
  </div>;
}

export default function ExpenseManagement() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [category, setCategory] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const filters = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params.toString();
  }, [page, category, search, startDate, endDate]);
  const summaryQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params.toString();
  }, [category, startDate, endDate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [expenseResult, summaryResult] = await Promise.all([
        expenseRequest(`/billing/expenses?${filters}`),
        expenseRequest(`/billing/expenses/reports/summary${summaryQuery ? `?${summaryQuery}` : ''}`)
      ]);
      setExpenses(expenseResult.data || []);
      setPagination(expenseResult.pagination || { total: 0, page, totalPages: 0 });
      setSummary(summaryResult);
    } catch (requestError) {
      setExpenses([]);
      setSummary(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page, summaryQuery]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchDraft.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);
  useEffect(() => {
    Promise.all([
      expenseRequest('/fleet/vehicles?page=1&limit=100'),
      expenseRequest('/trips?page=1&limit=100')
    ]).then(([vehicleResult, tripResult]) => {
      setVehicles(vehicleResult.data || []);
      setTrips(tripResult.data || []);
    }).catch((requestError) => setError(requestError.message));
  }, []);

  async function saveExpense(payload) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await expenseRequest('/billing/expenses', { method: 'POST', body: payload });
      setNotice(result.message || 'Expense recorded.');
      setFormOpen(false);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    if (!expenses.length) {
      setError('There are no expenses on this page to export.');
      return;
    }
    const columns = ['incurredAt', 'category', 'description', 'amount', 'vehicle', 'trip', 'vendor', 'reference', 'notes'];
    const csvRows = expenses.map((item) => ({
      ...item,
      incurredAt: new Date(item.incurredAt).toLocaleDateString(),
      vehicle: item.vehicleId?.registrationNumber || '',
      trip: item.tripId?.tripNumber || ''
    }));
    const content = [columns.map(csvCell).join(','), ...csvRows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">Billing & accounting</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950"><Receipt size={22} className="text-emerald-700" />Expense tracking</h1><p className="mt-1 text-sm text-slate-600">Record and review operating expenses with date, category and optional trip/vehicle references.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={exportCsv} disabled={loading || expenses.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><Download size={14} />Export page CSV</button><button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button><button type="button" onClick={() => setFormOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"><Plus size={14} />Record expense</button></div>
    </header>
    {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
    {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={16} />{notice}</div>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Expenses in selected period</p><p className="mt-2 text-xl font-bold text-slate-950">{summary?.entryCount ?? '—'}</p></article>
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Recorded expense total</p><p className="mt-2 text-xl font-bold text-slate-950">{summary ? rupees(summary.totalCostPaise) : '—'}</p></article>
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">Categories represented</p><p className="mt-2 text-xl font-bold text-slate-950">{summary?.byCategory?.length ?? '—'}</p></article>
    </section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Expense ledger</h2><p className="mt-0.5 text-xs text-slate-500">{pagination.total} record(s)</p></div>
          <label className="relative block"><span className="sr-only">Search expenses</span><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search description, vendor, receipt" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs sm:w-72" /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Filter by category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <label className="text-[10px] font-semibold text-slate-500">From<input type="date" value={startDate} max={endDate || localDate()} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} className="ml-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700" /></label>
          <label className="text-[10px] font-semibold text-slate-500">To<input type="date" value={endDate} min={startDate} max={localDate()} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} className="ml-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700" /></label>
        </div>
      </div>
      {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" />Loading expenses…</div>
        : expenses.length === 0 ? <div className="p-12 text-center"><Receipt size={24} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No expenses found</p><p className="mt-1 text-xs text-slate-500">Adjust filters or record the first expense.</p></div>
          : <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{['Date', 'Category', 'Description', 'Amount', 'Vehicle / Trip', 'Vendor / reference', 'Entered by'].map((item) => <th key={item} className="px-4 py-3 font-bold">{item}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{expenses.map((expense) => <tr key={expense._id} className="text-slate-700"><td className="whitespace-nowrap px-4 py-3">{new Date(expense.incurredAt).toLocaleDateString()}</td><td className="px-4 py-3">{expense.category}</td><td className="max-w-64 px-4 py-3"><p className="font-semibold text-slate-900">{expense.description}</p>{expense.notes && <p className="mt-1 truncate text-[10px] text-slate-500">{expense.notes}</p>}</td><td className="whitespace-nowrap px-4 py-3 font-bold">{rupees(expense.amountPaise)}</td><td className="px-4 py-3">{expense.vehicleId?.registrationNumber || '—'}{expense.tripId?.tripNumber && <p className="mt-1 text-[10px] text-slate-500">{expense.tripId.tripNumber}</p>}</td><td className="px-4 py-3">{expense.vendor || '—'}<p className="mt-1 text-[10px] text-slate-500">{expense.reference || '—'}</p></td><td className="px-4 py-3">{expense.createdByRole}</td></tr>)}</tbody>
          </table></div>}
      {pagination.totalPages > 1 && <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><button type="button" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-45">Previous</button><span className="text-xs text-slate-500">Page {page} of {pagination.totalPages}</span><button type="button" disabled={loading || page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-45">Next</button></footer>}
    </section>
    {formOpen && <ExpenseForm vehicles={vehicles} trips={trips} onClose={() => setFormOpen(false)} onSubmit={saveExpense} saving={saving} />}
  </div>;
}
