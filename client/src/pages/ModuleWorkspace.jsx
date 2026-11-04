import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDashed,
  Database,
  Eye,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import LoginAccessDialog from '../components/common/LoginAccessDialog';
import { apiFetch } from '../auth/session';
import { moduleWorkspaceByPath } from '../config/moduleWorkspaces';
import { readOnlyRoles } from '../config/navigation';

function getValue(record, path) {
  return path.split('.').reduce((value, key) => value?.[key], record);
}

function setValue(record, path, value) {
  const keys = path.split('.');
  let current = record;
  keys.slice(0, -1).forEach((key) => {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
    current = current[key];
  });
  current[keys[keys.length - 1]] = value;
}

function normalizeRecords(response) {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.report)) return data.report;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function reportRows(report) {
  const rows = [];
  const metrics = report?.summary || report?.metrics;
  if (metrics && typeof metrics === 'object' && !Array.isArray(metrics)) {
    rows.push(...Object.entries(metrics).map(([metric, value]) => ({
      metric,
      value: value && typeof value === 'object' ? JSON.stringify(value) : value,
      period: 'Summary'
    })));
  }
  if (Array.isArray(report?.vehicleTypeBreakdown)) {
    rows.push(...report.vehicleTypeBreakdown.map((item) => ({
      metric: `Vehicles: ${item._id || 'Other'}`,
      value: item.count,
      period: 'By vehicle type'
    })));
  }
  return rows;
}

function recordId(record) {
  return record?._id || record?.id || record?.bookingId || record?.tripId || '';
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function fieldInputClass() {
  return 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
}

function initialValues(fields, record) {
  const result = {};
  fields.forEach((field) => {
    const currentValue = record ? getValue(record, field.name) : undefined;
    const rawValue = currentValue ?? '';
    const value = field.type === 'date' && rawValue ? String(rawValue).slice(0, 10) : rawValue;
    setValue(result, field.name, value);
  });
  return result;
}

function WorkspaceForm({ workspace, record, onClose, onSubmit, saving }) {
  const [values, setValues] = useState(() => initialValues(workspace.fields, record));
  const [formError, setFormError] = useState('');
  const isEditing = Boolean(record);

  function updateField(field, value) {
    setValues((current) => {
      const updated = { ...current };
      setValue(updated, field.name, field.type === 'number' && value !== '' ? Number(value) : value);
      return updated;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    try {
      await onSubmit(values, record);
    } catch (error) {
      setFormError(error.message);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="workspace-form-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">{workspace.title}</p>
            <h2 id="workspace-form-title" className="mt-1 text-lg font-bold text-slate-900">
              {isEditing ? 'Update record' : `New ${workspace.singular || 'record'}`}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Changes are saved through the connected backend API.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit} className="space-y-5 px-5 py-5 sm:px-7">
          {formError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{formError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            {workspace.fields.filter((field) => field.type !== 'hidden').map((field) => (
              <label key={field.name} className={`text-xs font-semibold text-slate-700 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                {field.label}{field.required && <span className="ml-1 text-rose-600">*</span>}
                {field.type === 'select' ? (
                  <select required={field.required} value={getValue(values, field.name) ?? ''} onChange={(event) => updateField(field, event.target.value)} className={fieldInputClass()}>
                    {!field.required && <option value="">Select…</option>}
                    {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea required={field.required} rows={3} value={getValue(values, field.name) ?? ''} onChange={(event) => updateField(field, event.target.value)} className={fieldInputClass()} />
                ) : (
                  <input
                    required={field.required}
                    type={field.type || 'text'}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={getValue(values, field.name) ?? ''}
                    onChange={(event) => updateField(field, event.target.value)}
                    className={fieldInputClass()}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60">
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
              {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save record'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RecordDetails({ record, onClose }) {
  const entries = Object.entries(record || {}).filter(([key]) => !key.startsWith('__'));
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/40" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="record-details-title" className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Record details</p>
            <h2 id="record-details-title" className="mt-1 text-lg font-bold text-slate-900">{recordId(record) || 'Record'}</h2>
          </div>
          <button type="button" aria-label="Close details" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>
        <dl className="grid gap-3 p-5 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <dt className="break-all text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</dt>
              <dd className="mt-1 break-words text-xs font-medium text-slate-800">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function exportCsv(records, columns, filename) {
  if (!records.length) return;
  const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = [
    columns.map((column) => escapeCell(column.label)).join(','),
    ...records.map((record) => columns.map((column) => escapeCell(getValue(record, column.name))).join(','))
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildColumns(workspace) {
  if (workspace.columns) return workspace.columns;
  return workspace.fields.slice(0, 5).map((field) => ({ name: field.name, label: field.label }));
}

export default function ModuleWorkspace({ module, path = window.location.pathname }) {
  const config = moduleWorkspaceByPath[path];
  const Icon = module?.icon;
  const { role } = useAuth();
  const roleIsReadOnly = readOnlyRoles.includes(role);
  const workspace = useMemo(() => config ? ({
    ...config,
    readOnly: config.readOnly || roleIsReadOnly,
    title: config.title || module?.name || 'Workspace',
    description: config.description || module?.description,
    fields: config.fields || []
  }) : null, [config, module, roleIsReadOnly]);
  const columns = useMemo(() => workspace ? buildColumns(workspace) : [], [workspace]);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRecord, setBusyRecord] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formRecord, setFormRecord] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loginRecord, setLoginRecord] = useState(null);
  const loginAccess = !roleIsReadOnly ? workspace?.loginAccess : null;

  const statusField = workspace?.statusField || workspace?.fields.find((field) => ['status', 'vehicleStatus', 'driverStatus', 'allocationStatus'].includes(field.name));
  const statusOptions = workspace?.statusFilterOptions || statusField?.options || [];
  const statusTransitionOptions = workspace?.statusUpdateOptions || statusOptions;
  const reportFields = workspace?.kind === 'report' ? workspace.fields : [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const loadRecords = useCallback(async () => {
    if (!workspace) return;
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (statusFilter) params.set(statusField?.name || 'status', statusFilter);
    if (dateRange.startDate) params.set('startDate', dateRange.startDate);
    if (dateRange.endDate) params.set('endDate', dateRange.endDate);
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch(`/${workspace.endpoint}?${params.toString()}`).catch((requestError) => {
        throw new Error(requestError.status === 404
          ? `The ${workspace.title.toLowerCase()} API is not available yet (404).`
          : requestError.message);
      });
      let nextRecords = normalizeRecords(result);
      if (workspace.kind === 'report' && nextRecords.length === 0) {
        const reportData = result?.data ?? result;
        nextRecords = reportRows(reportData);
        if (!nextRecords.length && reportData && typeof reportData === 'object' && !Array.isArray(reportData)) {
          nextRecords = Object.entries(reportData)
            .filter(([key]) => !['pagination', 'summary', 'metrics', 'success', 'message', 'vehicleTypeBreakdown', 'scope'].includes(key))
            .map(([metric, value]) => ({
              metric,
              value: value && typeof value === 'object' ? JSON.stringify(value) : value,
              period: 'Summary'
            }));
        }
      }
      setRecords(nextRecords);
      const responsePagination = result.pagination || result.data?.pagination;
      setPagination(responsePagination ? {
        ...responsePagination,
        total: responsePagination.total ?? responsePagination.totalVehicles ?? responsePagination.totalAllocations,
        page: responsePagination.page ?? responsePagination.currentPage,
        totalPages: responsePagination.totalPages
      } : {
        total: nextRecords.length,
        page,
        totalPages: nextRecords.length ? page : 0
      });
    } catch (requestError) {
      setRecords([]);
      setPagination({ total: 0, page, totalPages: 0 });
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [workspace, page, search, statusFilter, statusField?.name, dateRange]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  async function request(pathSuffix, options = {}) {
    return apiFetch(`/${workspace.endpoint}${pathSuffix}`, options);
  }

  async function saveRecord(values, record) {
    setSaving(true);
    setError('');
    try {
      const id = record && recordId(record);
      const response = await request(id ? `/${encodeURIComponent(id)}` : '', {
        method: id ? 'PATCH' : 'POST',
        body: values
      });
      setFormOpen(false);
      setFormRecord(null);
      setNotice(response.message || (id ? 'Record updated.' : 'Record created.'));
      await loadRecords();
    } catch (requestError) {
      throw requestError;
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(record, nextStatus) {
    const id = recordId(record);
    if (!id) {
      setError('This record does not include an ID, so its status cannot be updated.');
      return;
    }
    setBusyRecord(id);
    setError('');
    setNotice('');
    try {
      const response = await request(`/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: { [statusField.name]: nextStatus }
      });
      setNotice(response.message || 'Status updated.');
      await loadRecords();
    } catch (requestError) {
      setError(requestError.message);
      await loadRecords();
    } finally {
      setBusyRecord('');
    }
  }

  async function deleteRecord(record) {
    const id = recordId(record);
    if (!id) {
      setError('This record does not include an ID, so it cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete ${workspace.singular || workspace.title.toLowerCase()} ${id}?`)) return;
    setBusyRecord(id);
    setError('');
    setNotice('');
    try {
      const response = await request(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setNotice(response.message || 'Record deleted.');
      await loadRecords();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyRecord('');
    }
  }

  if (!workspace) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">Workspace configuration is missing for this module.</div>;
  }

  const HeadingIcon = Icon || Database;
  const apiPath = `/api/v1/${workspace.endpoint}`;
  const totalRecords = pagination.total ?? pagination.totalRecords ?? pagination.totalVehicles;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800">
            <HeadingIcon size={23} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">{module?.category || 'Operations'}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{workspace.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{workspace.description}</p>
          </div>
        </div>
        {!workspace.readOnly && (
          <button type="button" onClick={() => { setFormRecord(null); setFormOpen(true); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800">
            <Plus size={15} />Add {workspace.singular || 'record'}
          </button>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-[minmax(12rem,0.65fr)_minmax(0,1.35fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Records in current view</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{loading ? '—' : records.length}</p>
          <p className="mt-1 text-[11px] text-slate-500">{totalRecords === undefined ? 'Live API results' : `${totalRecords} total matching records`}</p>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          {workspace.searchable !== false && <label className="relative min-w-0 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={`Search ${workspace.title.toLowerCase()}…`} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </label>}
          {statusOptions.length > 0 && (
            <select aria-label={`Filter ${workspace.title} by status`} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-emerald-600 sm:w-48">
              <option value="">All statuses</option>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          )}
          {reportFields.length > 0 && reportFields.map((field) => (
            <label key={field.name} className="text-[10px] font-semibold text-slate-500">
              {field.label}
              <input type="date" value={dateRange[field.name] || ''} onChange={(event) => { setDateRange((current) => ({ ...current, [field.name]: event.target.value })); setPage(1); }} className="mt-1 block rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-emerald-600" />
            </label>
          ))}
          {records.length > 0 && (
            <button type="button" onClick={() => exportCsv(records, columns, workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <ArrowDownToLine size={14} />Export
            </button>
          )}
          <button type="button" aria-label="Refresh records" onClick={loadRecords} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /><span className="sm:hidden">Refresh</span>
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">{error}</p>
            <p className="mt-1 break-all text-rose-700/80">API endpoint: {apiPath}</p>
          </div>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error" className="ml-auto shrink-0"><X size={14} /></button>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <Check size={15} /><span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice" className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{workspace.title} records</h2>
            <p className="mt-1 text-xs text-slate-500">Live records only · {apiPath}</p>
          </div>
          {workspace.readOnly && (
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-600">
              <CircleDashed size={13} />{roleIsReadOnly ? 'View only' : 'Read-only report'}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {columns.map((column) => <th key={column.name} className="px-5 py-3.5">{column.label}</th>)}
                {!workspace.readOnly && <th className="px-4 py-3.5">Status</th>}
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={columns.length + 2} className="px-5 py-14 text-center text-xs text-slate-500"><LoaderCircle size={18} className="mx-auto mb-2 animate-spin text-emerald-700" />Loading live records…</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={columns.length + 2} className="px-5 py-14 text-center">
                  <Database size={22} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">{error ? 'Live records unavailable' : 'No records found'}</p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{error ? 'Check the API connection and retry. This page does not display sample data.' : search || statusFilter ? 'Try changing the search or filter.' : 'No records have been returned for this workspace yet.'}</p>
                  {!error && !workspace.readOnly && (
                    <button type="button" onClick={() => { setFormRecord(null); setFormOpen(true); }} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800"><Plus size={14} />Add first record</button>
                  )}
                  {error && <p className="mt-3 break-all font-mono text-[10px] text-slate-400">{apiPath}</p>}
                </td></tr>
              ) : records.map((record, rowIndex) => {
                const id = recordId(record) || `record-${rowIndex}`;
                const status = statusField ? getValue(record, statusField.name) : '';
                return (
                  <tr key={id} className="transition hover:bg-slate-50/70">
                    {columns.map((column) => <td key={column.name} className="max-w-64 truncate px-5 py-4 text-xs text-slate-700" title={formatValue(getValue(record, column.name))}>{formatValue(getValue(record, column.name))}</td>)}
                    {!workspace.readOnly && (
                      <td className="px-4 py-4">
                        {statusField && status && !workspace.statusLockedValues?.includes(status) ? (
                          <select aria-label={`Update status for ${id}`} value={status} disabled={busyRecord === id} onChange={(event) => updateStatus(record, event.target.value)} className="max-w-44 rounded-full border-0 bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 outline-none disabled:opacity-50">
                            {[...new Set([status, ...statusTransitionOptions])].map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        ) : <span className="text-xs text-slate-500">{status || '—'}</span>}
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setSelectedRecord(record)} aria-label={`View record ${id}`} className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-800"><Eye size={14} /></button>
                        {loginAccess && recordId(record) && (
                          <button type="button" onClick={() => setLoginRecord(record)} aria-label={`Login access for ${id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50"><KeyRound size={13} />Login</button>
                        )}
                        {!workspace.readOnly && (
                          <>
                            {workspace.allowEdit !== false && <button type="button" onClick={() => { setFormRecord(record); setFormOpen(true); }} disabled={!recordId(record)} aria-label={`Edit record ${id}`} className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Edit</button>}
                            {workspace.allowDelete !== false && <button type="button" onClick={() => deleteRecord(record)} disabled={busyRecord === id || !recordId(record)} aria-label={`Delete record ${id}`} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 size={14} /></button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-500">
            {totalRecords !== undefined ? `${records.length} shown · ${totalRecords} total` : `${records.length} record${records.length === 1 ? '' : 's'} in this response`}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ArrowLeft size={13} />Previous</button>
            <span className="px-1 text-[11px] tabular-nums text-slate-500">Page {pagination.currentPage || pagination.page || page}{pagination.totalPages ? ` / ${pagination.totalPages}` : ''}</span>
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={loading || (pagination.totalPages ? page >= pagination.totalPages : records.length < 20)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Next<ArrowRight size={13} /></button>
          </div>
        </footer>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[10px] text-slate-500">
        <span>Records are displayed only when returned by the API. No seeded or demo data is used.</span>
        <Link to="/" className="font-semibold text-emerald-800 hover:text-emerald-950">Back to overview</Link>
      </div>

      {formOpen && <WorkspaceForm workspace={workspace} record={formRecord} onClose={() => { setFormOpen(false); setFormRecord(null); }} onSubmit={saveRecord} saving={saving} />}
      {selectedRecord && <RecordDetails record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
      {loginRecord && (
        <LoginAccessDialog
          role={loginAccess.role}
          profileId={recordId(loginRecord)}
          personName={getValue(loginRecord, loginAccess.name)}
          suggestedLoginId={String(getValue(loginRecord, loginAccess.suggestedLoginId) || '')}
          onClose={() => setLoginRecord(null)}
        />
      )}
    </div>
  );
}
