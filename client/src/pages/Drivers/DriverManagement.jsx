import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  IdCard,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { apiFetch } from '../../auth/session';
import LoginAccessDialog from '../../components/common/LoginAccessDialog';
import { useAuth } from '../../auth/AuthContext';
import { moduleByPath, readOnlyRoles } from '../../config/navigation';

const PAGE_SIZE = 20;
const routes = [
  ['/drivers/register', 'Driver Registration', UserRound],
  ['/drivers/licenses', 'License Management', IdCard],
  ['/drivers/documents', 'Driver Documents', FileText],
  ['/drivers/attendance', 'Driver Attendance', CalendarDays],
  ['/drivers/performance', 'Driver Performance', BadgeCheck],
  ['/drivers/salary', 'Driver Salary', CircleDollarSign]
];

const driverStatuses = ['Available', 'OnLeave', 'Inactive', 'Suspended'];
const fields = {
  driver: [
    { name: 'personalInfo.fullName', label: 'Full name', required: true, minLength: 2, maxLength: 100 },
    { name: 'personalInfo.dateOfBirth', label: 'Date of birth', type: 'date' },
    { name: 'personalInfo.gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'] },
    { name: 'contactInfo.phone', label: 'Mobile number', required: true, inputMode: 'numeric', maxLength: 10 },
    { name: 'contactInfo.alternatePhone', label: 'Alternate mobile', inputMode: 'numeric', maxLength: 10 },
    { name: 'contactInfo.email', label: 'Email', type: 'email' },
    { name: 'contactInfo.address.street', label: 'Street address' },
    { name: 'contactInfo.address.city', label: 'City' },
    { name: 'contactInfo.address.state', label: 'State' },
    { name: 'contactInfo.address.postalCode', label: 'Postal code' },
    { name: 'contactInfo.address.country', label: 'Country' },
    { name: 'emergencyContact.name', label: 'Emergency contact name' },
    { name: 'emergencyContact.relationship', label: 'Relationship' },
    { name: 'emergencyContact.phone', label: 'Emergency contact phone', inputMode: 'numeric', maxLength: 10 },
    { name: 'employmentDetails.joiningDate', label: 'Joining date', type: 'date', required: true },
    { name: 'employmentDetails.employmentType', label: 'Employment type', type: 'select', options: ['FullTime', 'Contract', 'Attached'], required: true },
    { name: 'employmentDetails.experienceYears', label: 'Experience (years)', type: 'number', min: 0, max: 60 },
    { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000 }
  ],
  license: [
    { name: 'driverId', label: 'Driver', type: 'driver', required: true },
    { name: 'licenseNumber', label: 'Licence number', required: true, maxLength: 100 },
    { name: 'licenseType', label: 'Licence class', type: 'select', options: ['LMV', 'HMV', 'Transport', 'Other'], required: true },
    { name: 'issueDate', label: 'Issue date', type: 'date' },
    { name: 'expiryDate', label: 'Expiry date', type: 'date', required: true }
  ],
  document: [
    { name: 'driverId', label: 'Driver', type: 'driver', required: true },
    { name: 'documentType', label: 'Document type', type: 'select', options: ['DrivingLicence', 'IdentityProof', 'AddressProof', 'MedicalCertificate', 'Other'], required: true },
    { name: 'documentNumber', label: 'Document number', maxLength: 100 },
    { name: 'issueDate', label: 'Issue date', type: 'date' },
    { name: 'expiryDate', label: 'Expiry date', type: 'date' },
    { name: 'file', label: 'Document file (optional; PDF, JPEG or PNG, max 5 MB)', type: 'file' }
  ],
  attendance: [
    { name: 'driverId', label: 'Driver', type: 'driver', required: true },
    { name: 'attendanceDate', label: 'Attendance date', type: 'date', required: true },
    { name: 'status', label: 'Attendance status', type: 'select', options: ['Present', 'Absent', 'OnLeave', 'HalfDay'], required: true },
    { name: 'checkIn', label: 'Check-in time', type: 'time' },
    { name: 'checkOut', label: 'Check-out time', type: 'time' },
    { name: 'remarks', label: 'Remarks', type: 'textarea', maxLength: 1000 }
  ],
  salary: [
    { name: 'driverId', label: 'Driver', type: 'driver', required: true },
    { name: 'periodStart', label: 'Pay period start', type: 'date', required: true },
    { name: 'periodEnd', label: 'Pay period end', type: 'date', required: true },
    { name: 'baseAmount', label: 'Base amount (INR)', type: 'number', min: 0, max: 100000000, step: '0.01', required: true },
    { name: 'allowances', label: 'Allowances (INR)', type: 'number', min: 0, max: 100000000, step: '0.01' },
    { name: 'deductions', label: 'Deductions (INR)', type: 'number', min: 0, max: 100000000, step: '0.01' }
  ]
};

const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const dateValue = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
const recordId = (record) => record?._id || record?.id || '';
const driverName = (driver) => driver?.personalInfo?.fullName || driver?.driverCode || 'Driver';
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';
const formatMoney = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const getPath = (record, path) => path.split('.').reduce((value, part) => value?.[part], record);

function queryString(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });
  return params.toString();
}

async function downloadDocument(record) {
  setBusyId(recordId(record)); setError('');
  try {
    const response = await apiFetch(`/drivers/documents/${encodeURIComponent(recordId(record))}/download`, { raw: true });
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = record.originalName || 'driver-document';
    link.click();
    URL.revokeObjectURL(objectUrl);
  } catch (requestError) {
    setError(requestError.message);
  } finally {
    setBusyId('');
  }
}

function makePayload(values, kind) {
  const payload = {};
  const fieldTypes = new Map((fields[kind] || []).map((field) => [field.name, field.type]));
  Object.entries(values).forEach(([path, raw]) => {
    if (fieldTypes.get(path) === 'file') return;
    if (raw === '' && ['date', 'number'].includes(fieldTypes.get(path))) return;
    const value = kind === 'driver' && ['employmentDetails.experienceYears'].includes(path)
      || ['baseAmount', 'allowances', 'deductions'].includes(path)
      ? Number(raw)
      : raw;
    const parts = path.split('.');
    let current = payload;
    parts.slice(0, -1).forEach((part) => {
      current[part] ||= {};
      current = current[part];
    });
    current[parts[parts.length - 1]] = value;
  });
  if (kind === 'attendance' && ['Absent', 'OnLeave'].includes(payload.status)) {
    payload.checkIn = '';
    payload.checkOut = '';
  }
  return payload;
}

function RecordForm({ kind, record, drivers, onClose, onSave }) {
  const formFields = fields[kind].filter((field) => !(record && field.type === 'file'));
  const [selectedFile, setSelectedFile] = useState(null);
  const [values, setValues] = useState(() => Object.fromEntries(formFields.map((field) => {
    const rawValue = getPath(record, field.name);
    const value = field.name === 'driverId' && rawValue
      ? String(rawValue?._id || rawValue)
      : rawValue;
    return [field.name, field.type === 'date' ? dateValue(value) : value ?? ''];
  })));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(makePayload(values, kind), record, selectedFile);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="driver-form-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Driver Management</p>
            <h2 id="driver-form-title" className="mt-1 text-lg font-bold text-slate-900">{record ? 'Edit record' : `Add ${kind === 'license' ? 'licence' : kind === 'document' ? 'document' : kind === 'salary' ? 'salary record' : kind}`}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>
        <form onSubmit={submit} className="space-y-5 p-5">
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            {formFields.map((field) => (
              <label key={field.name} className={`block text-xs font-semibold text-slate-700 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                {field.label}{field.required && <span className="ml-1 text-rose-600">*</span>}
                {field.type === 'select' || field.type === 'driver' ? (
                  <select required={field.required} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className={inputClass}>
                    <option value="">Select…</option>
                    {(field.type === 'driver' ? drivers.map((driver) => ({ value: driver._id, label: `${driverName(driver)} · ${driver.driverCode}` })) : field.options.map((value) => ({ value, label: value }))).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea required={field.required} maxLength={field.maxLength} rows={3} value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className={inputClass} />
                ) : field.type === 'file' ? (
                  <input required={field.required} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} className={inputClass} />
                ) : (
                  <input
                    required={field.required}
                    type={field.type || 'text'}
                    inputMode={field.inputMode}
                    min={field.min}
                    max={field.max}
                    minLength={field.minLength}
                    maxLength={field.maxLength}
                    step={field.step}
                    value={values[field.name]}
                    onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    className={inputClass}
                  />
                )}
              </label>
            ))}
          </div>
          {kind === 'salary' && <p className="text-xs text-slate-500">New records begin as Draft. Only Draft records are editable; approval and payment are tracked as separate audited status changes.</p>}
          {kind === 'document' && <p className="text-xs text-slate-500">A file is optional. Attached files are validated and stored privately. Only staff can upload; drivers can download only their own records.</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}{record ? 'Save changes' : 'Create record'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function StatusBadge({ value }) {
  const tone = ['Available', 'Valid', 'Present', 'Approved', 'Paid'].includes(value) ? 'bg-emerald-50 text-emerald-800'
    : ['OnLeave', 'ExpiringSoon', 'HalfDay', 'Draft', 'UnderReview'].includes(value) ? 'bg-amber-50 text-amber-800'
      : ['Inactive', 'Suspended', 'Expired', 'Absent', 'OnHold'].includes(value) ? 'bg-rose-50 text-rose-800'
        : 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>{value || '—'}</span>;
}

function Metric({ label, value, icon: Icon }) {
  return <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
    <div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value ?? '—'}</p></div>
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon size={19} /></span>
  </div>;
}

export default function DriverManagement({ path }) {
  const location = useLocation();
  const { role } = useAuth();
  const activePath = path || location.pathname;
  const activeTab = routes.find(([route]) => route === activePath)?.[0] || '/drivers/register';
  const title = moduleByPath[activeTab]?.name || 'Driver Registration';
  const isStaff = role === 'admin' || role === 'manager';
  const isReadOnly = readOnlyRoles.includes(role);
  const kind = activeTab === '/drivers/register' ? 'driver'
    : activeTab === '/drivers/licenses' ? 'license'
      : activeTab === '/drivers/documents' ? 'document'
        : activeTab === '/drivers/attendance' ? 'attendance'
          : activeTab === '/drivers/salary' ? 'salary' : 'performance';
  const endpoint = { driver: '/drivers', license: '/drivers/licenses', document: '/drivers/documents', attendance: '/drivers/attendance', salary: '/drivers/payments', performance: '/drivers/performance' }[kind];
  const [records, setRecords] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formRecord, setFormRecord] = useState(null);
  const [loginDriver, setLoginDriver] = useState(null);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchDraft.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => { setPage(1); setStatus(''); }, [activeTab]);

  useEffect(() => {
    if (!isStaff || kind === 'performance') return;
    let active = true;
    async function loadDrivers() {
      try {
        const all = [];
        let currentPage = 1;
        let totalPages = 1;
        while (currentPage <= totalPages) {
          const result = await apiFetch(`/drivers?page=${currentPage}&limit=100`);
          all.push(...(result.data?.data || []));
          totalPages = result.data?.pagination?.totalPages || 1;
          currentPage += 1;
        }
        if (active) setDrivers(all);
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    }
    loadDrivers();
    return () => { active = false; };
  }, [isStaff, kind]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {
        page,
        limit: PAGE_SIZE,
        search,
        ...(status ? kind === 'driver' ? { driverStatus: status } : { status } : {}),
        ...(kind === 'performance' && startDate ? { startDate } : {}),
        ...(kind === 'performance' && endDate ? { endDate } : {})
      };
      const result = await apiFetch(`${endpoint}?${queryString(filters)}`);
      if (kind === 'performance') {
        setPerformance(result.data || {});
        setRecords([]);
      } else {
        setRecords(result.data?.data || []);
        setPagination(result.data?.pagination || { total: 0, page, totalPages: 0 });
      }
    } catch (requestError) {
      setRecords([]);
      setPerformance(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, kind, page, search, status, startDate, endDate]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function saveRecord(payload, record, selectedFile) {
    if (kind === 'document' && !record) {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') formData.append(key, value);
      });
      if (selectedFile) formData.append('file', selectedFile);
      const response = await apiFetch(endpoint, { method: 'POST', body: formData });
      setFormRecord(null);
      setNotice(response.message || 'Driver document record created.');
      await loadRecords();
      return;
    }

    const id = recordId(record);
    const response = await apiFetch(`${endpoint}${id ? `/${encodeURIComponent(id)}` : ''}`, {
      method: id ? 'PATCH' : 'POST',
      body: payload
    });
    setFormRecord(null);
    setNotice(response.message || (id ? 'Record updated.' : 'Record created.'));
    await loadRecords();
  }

  async function changeStatus(record, nextStatus, statusKey) {
    const id = recordId(record);
    if (!id || !nextStatus) return;
    setBusyId(id); setError(''); setNotice('');
    try {
      const response = await apiFetch(`${endpoint}/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: { [statusKey]: nextStatus }
      });
      setNotice(response.message || 'Status updated.');
      await loadRecords();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  async function archiveRecord(record) {
    const id = recordId(record);
    if (!id || !window.confirm(`Archive this ${kind === 'salary' ? 'Draft salary record' : kind} record?`)) return;
    setBusyId(id); setError(''); setNotice('');
    try {
      const response = await apiFetch(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setNotice(response.message || 'Record archived.');
      await loadRecords();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  const columns = useMemo(() => ({
    driver: [
      ['driverCode', 'Driver ID'],
      ['personalInfo.fullName', 'Name'],
      ['contactInfo.phone', 'Mobile'],
      ['employmentDetails.employmentType', 'Employment'],
      ['employmentDetails.joiningDate', 'Joined'],
      ['driverStatus', 'Status']
    ],
    license: [
      ['driverId', 'Driver'],
      ['licenseNumber', 'Licence number'],
      ['licenseType', 'Class'],
      ['expiryDate', 'Expires'],
      ['status', 'Status']
    ],
    document: [
      ['driverId', 'Driver'],
      ['documentType', 'Document'],
      ['documentNumber', 'Document number'],
      ['expiryDate', 'Expires'],
      ['originalName', 'File']
    ],
    attendance: [
      ['driverId', 'Driver'],
      ['attendanceDate', 'Date'],
      ['status', 'Attendance'],
      ['checkIn', 'Check-in'],
      ['checkOut', 'Check-out'],
      ['remarks', 'Remarks']
    ],
    salary: [
      ['driverId', 'Driver'],
      ['periodStart', 'Period start'],
      ['periodEnd', 'Period end'],
      ['baseAmount', 'Base'],
      ['netAmount', 'Net pay'],
      ['status', 'Status']
    ]
  }[kind] || []), [kind]);

  function displayValue(record, key) {
    const value = getPath(record, key);
    if (key === 'driverId') return drivers.find((driver) => driver._id === String(value?._id || value))?.personalInfo?.fullName || value?.personalInfo?.fullName || value?.driverCode || 'Driver';
    if (['expiryDate', 'attendanceDate', 'periodStart', 'periodEnd', 'employmentDetails.joiningDate'].includes(key)) return formatDate(value);
    if (['baseAmount', 'netAmount'].includes(key)) return formatMoney(value);
    if (key === 'originalName') return value || (record.fileUrl ? <a href={record.fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-emerald-800 underline">Legacy link</a> : '—');
    if (key === 'driverStatus' || key === 'status') return <StatusBadge value={value} />;
    if (value && typeof value === 'object') return value.personalInfo ? driverName(value) : '—';
    return value || '—';
  }

  function availableTransitions(record) {
    if (kind === 'driver') return driverStatuses.filter((option) => option !== record.driverStatus);
    if (kind === 'license') return ['Valid', 'UnderReview'].filter((option) => option !== record.status);
    if (kind === 'salary') {
      return ({
        Draft: ['Approved', 'OnHold'],
        Approved: ['Paid', 'OnHold'],
        OnHold: ['Draft', 'Approved'],
        Paid: []
      })[record.status] || [];
    }
    return [];
  }

  const headingIcon = routes.find(([route]) => route === activeTab)?.[2] || Users;
  const statusOptions = kind === 'driver' ? ['', ...driverStatuses]
    : kind === 'license' ? ['', 'Valid', 'ExpiringSoon', 'Expired', 'UnderReview']
      : kind === 'attendance' ? ['', 'Present', 'Absent', 'OnLeave', 'HalfDay']
        : kind === 'salary' ? ['', 'Draft', 'Approved', 'Paid', 'OnHold'] : [];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><headingIcon size={21} /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">Driver Management</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">{moduleByPath[activeTab]?.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isStaff && kind !== 'performance' && <button type="button" onClick={() => setFormRecord({ create: true })} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800"><Plus size={14} />Add {kind === 'license' ? 'licence' : kind === 'document' ? 'document' : kind === 'salary' ? 'salary' : kind}</button>}
            <button type="button" onClick={loadRecords} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
          </div>
        </div>
        <nav className="mt-5 flex gap-2 overflow-x-auto border-t border-slate-100 pt-4">
          {routes.map(([route, label]) => (
            <Link key={route} to={route} aria-current={route === activeTab ? 'page' : undefined} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${route === activeTab ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</Link>
          ))}
        </nav>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><ShieldCheck size={16} className="mt-0.5 shrink-0" />{notice}</div>}

      {kind === 'performance' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <label className="text-xs font-semibold text-slate-600">From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={`${inputClass} min-w-40`} /></label>
            <label className="text-xs font-semibold text-slate-600">To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={`${inputClass} min-w-40`} /></label>
            <p className="pb-2 text-xs text-slate-500">{performance?.scope}</p>
          </div>
          {loading && !performance ? <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-10 text-slate-500"><LoaderCircle size={20} className="animate-spin" /></div> : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Active drivers" value={performance?.summary?.totalDrivers} icon={Users} />
                <Metric label="Attendance records" value={performance?.summary?.attendanceRecords} icon={ClipboardCheck} />
                <Metric label="Attendance rate" value={`${performance?.summary?.attendanceRate ?? 0}%`} icon={BadgeCheck} />
                <Metric label="Completed trips" value={performance?.summary?.completedTrips} icon={Check} />
                <Metric label="Present days" value={performance?.summary?.presentDays} icon={CalendarDays} />
                <Metric label="Absent days" value={performance?.summary?.absentDays} icon={AlertCircle} />
                <Metric label="Delayed trips" value={performance?.summary?.delayedTrips} icon={RefreshCw} />
                <Metric label="Cancelled trips" value={performance?.summary?.cancelledTrips} icon={X} />
              </div>
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Performance currently summarizes attendance and trip status totals. GPS-based distance, delivery punctuality, and route efficiency need connected GPS/device data and are not represented as available.</p>
            </>
          )}
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </label>
            {statusOptions.length > 0 && <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">{statusOptions.map((option) => <option key={option || 'all'} value={option}>{option || 'All statuses'}</option>)}</select>}
            <div className="text-xs text-slate-500">{pagination.total} records</div>
          </section>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {loading ? <div className="flex items-center justify-center gap-2 p-12 text-xs text-slate-500"><LoaderCircle size={16} className="animate-spin text-emerald-700" />Loading records…</div>
              : records.length === 0 ? <div className="p-12 text-center"><p className="text-sm font-semibold text-slate-800">No records found</p><p className="mt-1 text-xs text-slate-500">Adjust your search or filters, or add a new record.</p></div>
                : <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] border-collapse text-left">
                    <thead className="bg-slate-50"><tr>{columns.map(([, label]) => <th key={label} className="border-b border-slate-200 px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</th>)}<th className="border-b border-slate-200 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-slate-500">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((record) => {
                        const id = recordId(record);
                        const transitions = availableTransitions(record);
                        const statusKey = kind === 'driver' ? 'driverStatus' : 'status';
                        return <tr key={id} className="hover:bg-slate-50/70">
                          {columns.map(([key, label]) => <td key={label} className="max-w-56 px-4 py-3 text-xs text-slate-700">{displayValue(record, key)}</td>)}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {!isReadOnly && isStaff && kind === 'driver' && <button type="button" onClick={() => setLoginDriver(record)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100">Login</button>}
                              {kind === 'document' && record.originalName && <button type="button" onClick={() => downloadDocument(record)} disabled={busyId === id} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">Download</button>}
                              {!isReadOnly && isStaff && kind !== 'driver' && !(kind === 'salary' && record.status !== 'Draft') && <button type="button" onClick={() => setFormRecord(record)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100">Edit</button>}
                              {isStaff && transitions.length > 0 && <select aria-label={`Change status for ${id}`} disabled={busyId === id} value="" onChange={(event) => changeStatus(record, event.target.value, statusKey)} className="max-w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] text-slate-700 disabled:opacity-50">
                                <option value="">Change status</option>{transitions.map((next) => <option key={next} value={next}>{next}</option>)}
                              </select>}
                              {isStaff && (kind !== 'salary' || record.status === 'Draft') && <button type="button" onClick={() => archiveRecord(record)} disabled={busyId === id} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Archive</button>}
                            </div>
                          </td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>}
            {pagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <span className="text-[10px] text-slate-500">Page {pagination.page || page} of {pagination.totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"><ArrowLeft size={13} />Previous</button>
                <button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Next<ArrowRight size={13} /></button>
              </div>
            </div>}
          </section>
        </>
      )}

      {formRecord && <RecordForm kind={kind} record={formRecord.create ? null : formRecord} drivers={drivers} onClose={() => setFormRecord(null)} onSave={saveRecord} />}
      {loginDriver && <LoginAccessDialog role="driver" profileId={recordId(loginDriver)} personName={driverName(loginDriver)} suggestedLoginId={loginDriver.contactInfo?.phone} onClose={() => setLoginDriver(null)} />}
    </div>
  );
}
