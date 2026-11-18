import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, Check, ClipboardCheck, LoaderCircle, RefreshCw, Search, ShieldCheck, Wrench } from 'lucide-react';
import { apiFetch } from '../../auth/session';
import { useAuth } from '../../auth/AuthContext';

const pageDetails = {
  '/maintenance/schedule': { title: 'Service schedule', description: 'Plan vehicle servicing and set date or odometer-based due reminders.' },
  '/maintenance/repairs': { title: 'Repair management', description: 'Create repair work orders and track vehicle downtime through completion.' },
  '/maintenance/insurance': { title: 'Insurance tracking', description: 'Maintain insurance policy details and monitor upcoming expiry dates.' },
  '/maintenance/fitness': { title: 'Fitness certificates', description: 'Maintain vehicle fitness-certificate details and expiry reminders.' },
  '/maintenance/history': { title: 'Maintenance history', description: 'Review auditable service and repair records for the fleet.' },
  '/maintenance/reminders': { title: 'Maintenance reminders', description: 'See due service work and expiring insurance and fitness documents.' },
  '/reports/maintenance': { title: 'Maintenance reports', description: 'Review service and repair workload and recorded maintenance costs.' }
};

const documentDetails = {
  '/maintenance/insurance': { type: 'insurance', title: 'Insurance' },
  '/maintenance/fitness': { type: 'fitnessCertificate', title: 'Fitness certificate' }
};

async function maintenanceRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function rupees(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise || 0) / 100);
}

function vehicleLabel(vehicle) {
  return vehicle?.registrationNumber || 'Vehicle unavailable';
}

function initialRecordDraft(recordType) {
  return {
    vehicleId: '',
    recordType,
    title: '',
    description: '',
    scheduledAt: localDate(new Date()),
    dueOdometerKm: '',
    vendor: '',
    estimatedCost: ''
  };
}

function initialDocumentDraft() {
  return { documentNumber: '', fileUrl: '', issueDate: '', expiryDate: '' };
}

function MaintenanceManagement({ path }) {
  const page = pageDetails[path] || pageDetails['/maintenance/history'];
  const documentPage = documentDetails[path];
  const recordType = path === '/maintenance/repairs' ? 'Repair' : 'Service';
  const { role } = useAuth();
  const isStaff = role === 'admin' || role === 'manager';
  const [vehicles, setVehicles] = useState([]);
  const [records, setRecords] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [draft, setDraft] = useState(() => initialRecordDraft(recordType));
  const [documentDraft, setDocumentDraft] = useState(initialDocumentDraft);
  const [documentVehicleId, setDocumentVehicleId] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [search, setSearch] = useState('');
  const [recordPage, setRecordPage] = useState(1);
  const [recordPagination, setRecordPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [reminderPage, setReminderPage] = useState(1);
  const [reminderPagination, setReminderPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [completionDrafts, setCompletionDrafts] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle._id, vehicle])), [vehicles]);
  const documentVehicle = vehicleById.get(documentVehicleId);

  const loadData = useCallback(async () => {
    if (!isStaff) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(recordPage), limit: '20' });
      if (search.trim()) params.set('search', search.trim());
      if (path === '/maintenance/schedule') params.set('recordType', 'Service');
      if (path === '/maintenance/repairs') params.set('recordType', 'Repair');
      const vehicleParams = new URLSearchParams({ page: '1', limit: '100' });
      if (vehicleSearch.trim()) vehicleParams.set('search', vehicleSearch.trim());
      const [vehicleResult, recordResult, summaryResult, reminderResult] = await Promise.all([
        maintenanceRequest(`/maintenance/options/vehicles?${vehicleParams}`),
        maintenanceRequest(`/maintenance/records?${params}`),
        maintenanceRequest('/maintenance/reports/summary'),
        path === '/maintenance/reminders'
          ? maintenanceRequest(`/maintenance/reminders?days=30&page=${reminderPage}&limit=20`)
          : Promise.resolve({ data: [], pagination: { total: 0, page: 1, totalPages: 0 } })
      ]);
      setVehicles(vehicleResult.data || []);
      setRecords(recordResult.data || []);
      setRecordPagination(recordResult.pagination || { total: 0, page: recordPage, totalPages: 0 });
      setSummary(summaryResult);
      setReminders(reminderResult.data || []);
      setReminderPagination(reminderResult.pagination || { total: 0, page: reminderPage, totalPages: 0 });
      setDocumentVehicleId((current) => vehicleResult.data?.some((vehicle) => vehicle._id === current)
        ? current
        : vehicleResult.data?.[0]?._id || '');
    } catch (requestError) {
      setRecords([]);
      setRecordPagination({ total: 0, page: recordPage, totalPages: 0 });
      setReminders([]);
      setReminderPagination({ total: 0, page: reminderPage, totalPages: 0 });
      setSummary(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [isStaff, path, recordPage, reminderPage, search, vehicleSearch]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setRecordPage(1);
    setReminderPage(1);
    setSearch('');
  }, [path]);

  useEffect(() => {
    setDraft(initialRecordDraft(recordType));
  }, [recordType]);

  useEffect(() => {
    const document = documentVehicle?.documents?.[documentPage?.type];
    setDocumentDraft({
      documentNumber: document?.documentNumber || '',
      fileUrl: document?.fileUrl || '',
      issueDate: localDate(document?.issueDate),
      expiryDate: localDate(document?.expiryDate)
    });
  }, [documentPage?.type, documentVehicleId, documentVehicle]);

  async function createRecord(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await maintenanceRequest('/maintenance/records', {
        method: 'POST',
        body: {
          ...draft,
          scheduledAt: new Date(`${draft.scheduledAt}T12:00:00`).toISOString(),
          dueOdometerKm: draft.dueOdometerKm === '' ? null : Number(draft.dueOdometerKm),
          estimatedCost: draft.estimatedCost === '' ? null : Number(draft.estimatedCost)
        }
      });
      setNotice(`${result.recordNumber} scheduled for ${vehicleLabel(result.vehicleId)}.`);
      setDraft(initialRecordDraft(recordType));
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDocument(event) {
    event.preventDefault();
    if (!documentVehicleId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await maintenanceRequest(`/maintenance/vehicles/${encodeURIComponent(documentVehicleId)}/documents/${documentPage.type}`, {
        method: 'PATCH',
        body: {
          ...documentDraft,
          issueDate: documentDraft.issueDate || null
        }
      });
      setNotice(`${documentPage.title} details saved for ${vehicleLabel(documentVehicle)}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function transitionRecord(record, status) {
    let payload = { status };
    if (status === 'Cancelled') {
      const remarks = window.prompt(`Why are you cancelling ${record.recordNumber}?`);
      if (!remarks?.trim()) return;
      payload.remarks = remarks.trim();
    } else if (status === 'Completed') {
      const completion = completionDrafts[record._id] || {};
      if (completion.actualCost === undefined || completion.actualCost === '' || completion.odometer === undefined || completion.odometer === '') {
        setError('Enter the actual maintenance cost and completion odometer before completing the record.');
        return;
      }
      payload = {
        status,
        actualCost: Number(completion.actualCost),
        completionOdometerKm: Number(completion.odometer),
        completionRemarks: completion.remarks || ''
      };
    }
    setBusyId(record._id);
    setError('');
    setNotice('');
    try {
      await maintenanceRequest(`/maintenance/records/${encodeURIComponent(record._id)}/status`, { method: 'PATCH', body: payload });
      setNotice(`${record.recordNumber} marked ${status.toLowerCase()}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  function updateCompletion(recordId, field, value) {
    setCompletionDrafts((current) => ({
      ...current,
      [recordId]: { ...current[recordId], [field]: value }
    }));
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

  if (!isStaff) {
    return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Maintenance records are available to staff only.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800">{documentPage ? <ShieldCheck size={22} /> : <Wrench size={22} />}</div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Vehicle maintenance</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{page.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{page.description}</p>
          </div>
        </div>
        <button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><Check size={15} />{notice}</div>}

      {summary && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Scheduled', summary.counts.filter((item) => item.status === 'Scheduled').reduce((total, item) => total + item.count, 0)],
            ['In progress', summary.counts.filter((item) => item.status === 'InProgress').reduce((total, item) => total + item.count, 0)],
            ['Completed', summary.completed.reduce((total, item) => total + item.completedCount, 0)],
            ['Completed costs', rupees(summary.completed.reduce((total, item) => total + item.actualCostPaise, 0))]
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">{value}</p></div>)}
        </section>
      )}

      {(['/maintenance/schedule', '/maintenance/repairs', '/maintenance/insurance', '/maintenance/fitness'].includes(path)) && (
        <label className="block max-w-sm text-[10px] font-semibold text-slate-600">Find a vehicle<input value={vehicleSearch} onChange={(event) => {
          setVehicleSearch(event.target.value);
          setRecordPage(1);
        }} placeholder="Search registration or model" className={inputClass} /></label>
      )}

      {(path === '/maintenance/schedule' || path === '/maintenance/repairs') && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><CalendarClock size={16} className="text-emerald-700" /><h2 className="text-sm font-bold text-slate-900">{recordType === 'Service' ? 'Schedule service' : 'Create repair work order'}</h2></div>
          <form onSubmit={createRecord} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-[10px] font-semibold text-slate-600">Vehicle<select required value={draft.vehicleId} onChange={(event) => setDraft((current) => ({ ...current, vehicleId: event.target.value }))} className={inputClass}><option value="">Select a vehicle</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicleLabel(vehicle)} · {vehicle.vehicleStatus}</option>)}</select></label>
            <label className="text-[10px] font-semibold text-slate-600">{recordType === 'Service' ? 'Service title' : 'Repair title'}<input required minLength={2} maxLength={150} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={recordType === 'Service' ? 'e.g. Periodic service' : 'e.g. Brake repair'} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Scheduled / due date<input required type="date" value={draft.scheduledAt} onChange={(event) => setDraft((current) => ({ ...current, scheduledAt: event.target.value }))} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Due at odometer (km)<input type="number" min="0" max="100000000" step="1" value={draft.dueOdometerKm} onChange={(event) => setDraft((current) => ({ ...current, dueOdometerKm: event.target.value }))} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Service center / workshop<input maxLength="150" value={draft.vendor} onChange={(event) => setDraft((current) => ({ ...current, vendor: event.target.value }))} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Estimated cost (INR)<input type="number" min="0" max="100000000" step="0.01" value={draft.estimatedCost} onChange={(event) => setDraft((current) => ({ ...current, estimatedCost: event.target.value }))} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600 sm:col-span-2">Work details / reported issue<input maxLength="2000" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className={inputClass} /></label>
            <div className="flex items-end sm:col-span-2 xl:col-span-4"><button type="submit" disabled={saving || !draft.vehicleId} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : <CalendarClock size={14} />}Save {recordType.toLowerCase()}</button></div>
          </form>
        </section>
      )}

      {documentPage && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-slate-900">Update {documentPage.title.toLowerCase()} record</h2>
            <form onSubmit={saveDocument} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-[10px] font-semibold text-slate-600">Vehicle<select required value={documentVehicleId} onChange={(event) => setDocumentVehicleId(event.target.value)} className={inputClass}><option value="">Select a vehicle</option>{vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicleLabel(vehicle)}</option>)}</select></label>
              <label className="text-[10px] font-semibold text-slate-600">Policy / certificate number<input maxLength="100" value={documentDraft.documentNumber} onChange={(event) => setDocumentDraft((current) => ({ ...current, documentNumber: event.target.value }))} className={inputClass} /></label>
              <label className="text-[10px] font-semibold text-slate-600">Issue date<input type="date" value={documentDraft.issueDate} onChange={(event) => setDocumentDraft((current) => ({ ...current, issueDate: event.target.value }))} className={inputClass} /></label>
              <label className="text-[10px] font-semibold text-slate-600">Expiry date<input required type="date" value={documentDraft.expiryDate} onChange={(event) => setDocumentDraft((current) => ({ ...current, expiryDate: event.target.value }))} className={inputClass} /></label>
              <label className="text-[10px] font-semibold text-slate-600 sm:col-span-2">Document URL (private storage link)<input type="url" maxLength="1000" value={documentDraft.fileUrl} onChange={(event) => setDocumentDraft((current) => ({ ...current, fileUrl: event.target.value }))} className={inputClass} /></label>
              <div className="flex items-end"><button type="submit" disabled={saving || !documentVehicleId} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}Save document</button></div>
            </form>
            <p className="mt-3 text-[10px] leading-5 text-amber-800">This stores document metadata and a URL only. Upload access control and private document storage must be configured before placing sensitive files at the link.</p>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-bold text-slate-900">Fleet {documentPage.title.toLowerCase()} register</h2></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Document number</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{vehicles.map((vehicle) => {
              const document = vehicle.documents?.[documentPage.type] || {};
              const expiry = document.expiryDate ? new Date(document.expiryDate) : null;
              const days = expiry ? Math.ceil((new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate())) - new Date(new Date().toISOString().slice(0, 10))) / 86400000) : null;
              const status = days == null ? 'Missing' : days < 0 ? 'Expired' : days <= 30 ? 'Due soon' : 'Valid';
              return <tr key={vehicle._id}><td className="px-4 py-3 font-semibold">{vehicleLabel(vehicle)}</td><td className="px-4 py-3">{document.documentNumber || '—'}</td><td className="px-4 py-3">{dateLabel(expiry)}</td><td className={`px-4 py-3 font-semibold ${status === 'Expired' ? 'text-rose-700' : status === 'Due soon' || status === 'Missing' ? 'text-amber-700' : 'text-emerald-700'}`}>{status}</td></tr>;
            })}</tbody></table></div>
          </section>
        </>
      )}

      {path === '/maintenance/reminders' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3"><CalendarClock size={15} className="text-amber-700" /><h2 className="text-sm font-bold text-slate-900">Due within 30 days or overdue</h2></div>
          {loading ? <div className="p-8 text-center text-xs text-slate-500">Loading reminders…</div> : reminders.length === 0 ? <p className="p-8 text-center text-xs text-slate-500">No maintenance or compliance reminders in this period.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Reminder</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Due date / odometer</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{reminders.map((item) => <tr key={`${item.type}-${item.recordId || item.vehicleId}-${item.title}`}><td className="px-4 py-3"><strong>{item.title}</strong><div className="mt-1 text-[10px] text-slate-500">{item.recordNumber || (item.type === 'Maintenance' ? 'Scheduled maintenance' : 'Compliance document')}</div></td><td className="px-4 py-3">{item.registrationNumber}</td><td className="px-4 py-3">{dateLabel(item.dueAt)}{item.dueOdometerKm != null && <div className="mt-1 text-[10px] text-slate-500">{item.dueOdometerKm.toLocaleString('en-IN')} km due · latest {item.currentOdometerKm?.toLocaleString('en-IN') || 'not recorded'}</div>}</td><td className={`px-4 py-3 font-semibold ${item.status === 'Overdue' ? 'text-rose-700' : 'text-amber-700'}`}>{item.status}</td></tr>)}</tbody></table></div>}
          {reminderPagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500"><span>{reminderPagination.total} reminders · Page {reminderPage} of {reminderPagination.totalPages}</span><div className="flex gap-2"><button type="button" disabled={reminderPage <= 1 || loading} onClick={() => setReminderPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={reminderPage >= reminderPagination.totalPages || loading} onClick={() => setReminderPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Next</button></div></div>}
        </section>
      )}

      {!documentPage && path !== '/maintenance/reminders' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><ClipboardCheck size={15} className="text-emerald-700" /><h2 className="text-sm font-bold text-slate-900">{path === '/maintenance/history' ? 'Maintenance history' : `${recordType} records`}</h2></div><label className="relative text-[10px] font-semibold text-slate-500"><Search size={13} className="absolute bottom-2.5 left-2.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search number, title, workshop…" className="rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-emerald-600" /></label></div>
          {loading ? <div className="flex items-center justify-center gap-2 p-10 text-xs text-slate-500"><LoaderCircle size={15} className="animate-spin" />Loading maintenance records…</div> : records.length === 0 ? <p className="p-8 text-center text-xs text-slate-500">No maintenance records match this view.</p> : <div className="divide-y divide-slate-100">{records.map((record) => {
            const completion = completionDrafts[record._id] || {};
            const vehicle = vehicleById.get(record.vehicleId?._id || record.vehicleId);
            return <article key={record._id} className="space-y-3 p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-slate-900">{record.recordNumber}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">{record.recordType}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${record.status === 'Completed' ? 'bg-emerald-50 text-emerald-800' : record.status === 'InProgress' ? 'bg-sky-50 text-sky-800' : record.status === 'Cancelled' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800'}`}>{record.status}</span></div><p className="mt-1 text-sm font-semibold text-slate-800">{record.title}</p><p className="mt-1 text-[10px] text-slate-500">{vehicleLabel(record.vehicleId)} · Scheduled {dateLabel(record.scheduledAt)}{record.dueOdometerKm != null ? ` · Due at ${record.dueOdometerKm.toLocaleString('en-IN')} km` : ''}</p>{record.description && <p className="mt-2 text-xs text-slate-600">{record.description}</p>}</div>
                <div className="text-xs sm:text-right"><p className="font-semibold text-slate-800">{record.vendor || 'No workshop specified'}</p><p className="mt-1 text-[10px] text-slate-500">Estimate {record.estimatedCost == null ? '—' : rupees(record.estimatedCost * 100)} · Actual {record.actualCost == null ? '—' : rupees(record.actualCost * 100)}</p></div>
              </div>
              {record.status === 'InProgress' && <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end"><label className="text-[10px] font-semibold text-slate-600">Actual cost (INR)<input type="number" min="0" step="0.01" value={completion.actualCost ?? ''} onChange={(event) => updateCompletion(record._id, 'actualCost', event.target.value)} className={inputClass} /></label><label className="text-[10px] font-semibold text-slate-600">Completion odometer (km)<input type="number" min={vehicle?.lastFuelOdometerKm || 0} step="1" value={completion.odometer ?? ''} onChange={(event) => updateCompletion(record._id, 'odometer', event.target.value)} className={inputClass} /></label><label className="text-[10px] font-semibold text-slate-600">Completion notes<input maxLength="1000" value={completion.remarks || ''} onChange={(event) => updateCompletion(record._id, 'remarks', event.target.value)} className={inputClass} /></label><button type="button" disabled={busyId === record._id} onClick={() => transitionRecord(record, 'Completed')} className="rounded-lg bg-emerald-700 px-3 py-2.5 text-[10px] font-bold text-white disabled:opacity-50">Complete</button></div>}
              {record.status === 'Scheduled' && <div className="flex gap-2"><button type="button" disabled={busyId === record._id} onClick={() => transitionRecord(record, 'InProgress')} className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">Start maintenance</button><button type="button" disabled={busyId === record._id} onClick={() => transitionRecord(record, 'Cancelled')} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 disabled:opacity-50">Cancel schedule</button></div>}
              {record.statusHistory?.length > 0 && <p className="text-[10px] text-slate-400">Last updated {dateLabel(record.statusHistory.at(-1).createdAt)}</p>}
            </article>;
          })}</div>}
          {recordPagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500"><span>{recordPagination.total} records · Page {recordPage} of {recordPagination.totalPages}</span><div className="flex gap-2"><button type="button" disabled={recordPage <= 1 || loading} onClick={() => setRecordPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={recordPage >= recordPagination.totalPages || loading} onClick={() => setRecordPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">Next</button></div></div>}
        </section>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">
        Starting service/repair marks an available vehicle Under Maintenance and blocks fleet allocation until completion. Due-odometer reminders use the latest odometer captured in Fuel Management. Document metadata is stored here; private file upload/storage and automatic SMS/email reminders are not configured.
      </div>
    </div>
  );
}

export default MaintenanceManagement;
