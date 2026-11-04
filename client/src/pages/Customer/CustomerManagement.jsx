import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  KeyRound,
  LoaderCircle,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { apiFetch } from '../../auth/session';
import LoginAccessDialog from '../../components/common/LoginAccessDialog';

const PAGE_SIZE = 10;

// Signed-in staff token (super admin or manager) is attached by apiFetch.
async function apiRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data;
}

async function downloadFile(path, filename) {
  const response = await apiFetch(path, { raw: true });
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-rose-200 bg-rose-50 text-rose-800',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
    slate: 'border-slate-200 bg-slate-100 text-slate-700'
  };
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function toneFor(value) {
  if (value === 'Active' || value === 'Verified') return 'green';
  if (value === 'Pending' || value === 'NotSubmitted') return 'amber';
  if (value === 'Suspended' || value === 'Rejected') return 'red';
  return 'slate';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatBytes(bytes = 0) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function labelDocumentType(type) {
  return ({ pan: 'PAN', gstin: 'GSTIN', address_proof: 'Address proof' })[type] || type;
}

function getInitials(value = '') {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CU';
}

function shortId(value = '') {
  return value.length > 10 ? `CUS-${value.slice(-6).toUpperCase()}` : value;
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-semibold text-slate-600">{label}</span>
      <input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
    </label>
  );
}

function Metric({ label, value, icon: Icon, tone = 'green', onClick, active = false }) {
  const tones = {
    green: 'border-t-emerald-600 bg-emerald-50/40 text-emerald-800',
    amber: 'border-t-amber-500 bg-amber-50/50 text-amber-800',
    red: 'border-t-rose-500 bg-rose-50/40 text-rose-800',
    blue: 'border-t-sky-600 bg-sky-50/40 text-sky-800'
  };
  const iconTone = tone === 'amber' ? 'bg-amber-100 text-amber-800' : tone === 'red' ? 'bg-rose-100 text-rose-800' : tone === 'blue' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800';
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-[6.25rem] items-center justify-between gap-3 rounded-lg border border-slate-200 border-t-[3px] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tones[tone]} ${active ? 'ring-2 ring-emerald-700 ring-offset-1' : ''}`}>
      <span className="min-w-0"><span className="block text-xs font-semibold text-slate-600">{label}</span><span className="mt-1 block text-[26px] font-bold tabular-nums leading-none text-slate-950">{value ?? '—'}</span><span className="mt-2 block text-[11px] font-medium text-slate-500">View records</span></span>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${iconTone}`}><Icon size={20} strokeWidth={1.9} /></span>
    </button>
  );
}

function CustomerDetail({ customer, activities, kycDocuments, loading, onClose, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [status, setStatus] = useState(customer.status);
  const [statusReason, setStatusReason] = useState(customer.statusReason || '');
  const [kycRemarks, setKycRemarks] = useState(customer.kycRemarks || '');
  const [documentRemarks, setDocumentRemarks] = useState('');
  const [activityType, setActivityType] = useState('note');
  const [activitySubject, setActivitySubject] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    setDraft({
      companyName: customer.companyName || '', contactPerson: customer.contactPerson || '',
      customerType: customer.customerType || 'business', businessType: customer.businessType || '',
      phone: customer.phone || '', email: customer.email || '', gstin: customer.gstin || '', pan: customer.pan || '',
      address: { street: customer.address?.street || '', city: customer.address?.city || '', state: customer.address?.state || '', pincode: customer.address?.pincode || '' },
      notes: customer.notes || ''
    });
    setStatus(customer.status);
    setStatusReason(customer.statusReason || '');
    setKycRemarks(customer.kycRemarks || '');
  }, [customer]);

  async function performAction(key, action) {
    setBusyAction(key);
    try { await action(); onChanged(); } catch (error) { onError(error); } finally { setBusyAction(''); }
  }

  function updateDraft(name, value) { setDraft((current) => ({ ...current, [name]: value })); }
  function updateAddress(name, value) { setDraft((current) => ({ ...current, address: { ...current.address, [name]: value } })); }

  function saveProfile(event) {
    event.preventDefault();
    performAction('profile', async () => {
      await apiRequest(`/customers/management/${customer._id}`, { method: 'PUT', body: draft });
      setEditing(false);
    });
  }

  function saveStatus(event) {
    event.preventDefault();
    performAction('status', () => apiRequest(`/customers/management/${customer._id}/status`, { method: 'PATCH', body: { status, remarks: statusReason } }));
  }

  function reviewKyc(nextStatus) {
    if (nextStatus === 'Rejected' && !kycRemarks.trim()) { onError(new Error('Add a reason before rejecting KYC.')); return; }
    performAction('kyc', () => apiRequest(`/customers/management/${customer._id}/kyc`, { method: 'PATCH', body: { status: nextStatus, remarks: kycRemarks } }));
  }

  function reviewDocument(documentId, nextStatus) {
    if (nextStatus === 'Rejected' && !documentRemarks.trim()) { onError(new Error('Add a reason before rejecting a document.')); return; }
    performAction(`document-${documentId}`, () => apiRequest(
      `/customers/management/${customer._id}/kyc/documents/${documentId}/review`,
      { method: 'PATCH', body: { status: nextStatus, remarks: documentRemarks } }
    ));
  }

  function createActivity(event) {
    event.preventDefault();
    performAction('activity', async () => {
      await apiRequest(`/customers/management/${customer._id}/activities`, {
        method: 'POST',
        body: { type: activityType, subject: activitySubject, description: activityDescription, ...(activityType === 'follow_up' ? { followUpAt: new Date(followUpAt).toISOString() } : {}) }
      });
      setActivitySubject(''); setActivityDescription(''); setFollowUpAt('');
    });
  }

  const documentsVerified = kycDocuments.every((document) => document.status === 'Verified');

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/40 sm:inset-y-0 sm:left-auto sm:w-[min(48rem,92vw)]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="customer-detail-title" className="ml-auto flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Customer record</p><h2 id="customer-detail-title" className="mt-1 truncate text-lg font-bold text-slate-900">{customer.companyName || customer.contactPerson || customer.phone}</h2><p className="mt-1 font-mono text-xs text-slate-500">{customer._id}</p></div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setLoginOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><KeyRound size={13} />Login access</button>
            <button type="button" onClick={onClose} aria-label="Close customer details" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {loading && <p className="text-xs text-slate-500">Refreshing customer data…</p>}
          <section className="border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2"><Badge tone={toneFor(customer.status)}>{customer.status}</Badge><Badge tone={toneFor(customer.kycStatus)}>{customer.kycStatus || 'NotSubmitted'}</Badge><Badge>{customer.customerType || 'business'}</Badge></div><span className="text-[11px] text-slate-500">Joined {formatDate(customer.createdAt)}</span></div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2 text-slate-700"><UserRound size={15} className="shrink-0 text-slate-400" />{customer.contactPerson || 'No contact name'}</p>
              <p className="flex items-center gap-2 text-slate-700"><Phone size={15} className="shrink-0 text-slate-400" />{customer.phone}</p>
              <p className="flex items-center gap-2 break-all text-slate-700"><Mail size={15} className="shrink-0 text-slate-400" />{customer.email || 'No email'}</p>
              <p className="flex items-center gap-2 text-slate-700"><MapPin size={15} className="shrink-0 text-slate-400" />{[customer.address?.city, customer.address?.state].filter(Boolean).join(', ') || 'No address'}</p>
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Building2 size={16} />Customer profile</h3><button type="button" onClick={() => setEditing((current) => !current)} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">{editing ? 'Cancel edit' : 'Edit profile'}</button></div>
            {editing ? (
              <form onSubmit={saveProfile} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Company / customer name" value={draft.companyName} onChange={(value) => updateDraft('companyName', value)} />
                  <Field label="Contact person" value={draft.contactPerson} onChange={(value) => updateDraft('contactPerson', value)} />
                  <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Customer type</span><select value={draft.customerType} onChange={(event) => updateDraft('customerType', event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="business">Business</option><option value="individual">Individual</option></select></label>
                  <Field label="Business type" value={draft.businessType} onChange={(value) => updateDraft('businessType', value)} />
                  <Field label="Phone" value={draft.phone} onChange={(value) => updateDraft('phone', value)} />
                  <Field label="Email" value={draft.email} onChange={(value) => updateDraft('email', value)} type="email" />
                  <Field label="GSTIN" value={draft.gstin} onChange={(value) => updateDraft('gstin', value.toUpperCase())} />
                  <Field label="PAN" value={draft.pan} onChange={(value) => updateDraft('pan', value.toUpperCase())} />
                  <Field label="Street" value={draft.address?.street} onChange={(value) => updateAddress('street', value)} />
                  <Field label="City" value={draft.address?.city} onChange={(value) => updateAddress('city', value)} />
                  <Field label="State" value={draft.address?.state} onChange={(value) => updateAddress('state', value)} />
                  <Field label="Pincode" value={draft.address?.pincode} onChange={(value) => updateAddress('pincode', value)} />
                </div>
                <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Internal notes</span><textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} rows="2" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
                <button disabled={busyAction === 'profile'} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{busyAction === 'profile' ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Save profile</button>
              </form>
            ) : (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
                <div><dt className="text-slate-500">GSTIN</dt><dd className="mt-1 font-medium text-slate-800">{customer.gstin || '—'}</dd></div>
                <div><dt className="text-slate-500">PAN</dt><dd className="mt-1 font-medium text-slate-800">{customer.pan || '—'}</dd></div>
                <div><dt className="text-slate-500">Business type</dt><dd className="mt-1 font-medium text-slate-800">{customer.businessType || '—'}</dd></div>
                <div><dt className="text-slate-500">Address</dt><dd className="mt-1 font-medium text-slate-800">{[customer.address?.street, customer.address?.city, customer.address?.state, customer.address?.pincode].filter(Boolean).join(', ') || '—'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-slate-500">Internal notes</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-800">{customer.notes || '—'}</dd></div>
              </dl>
            )}
          </section>

          <section className="border border-slate-200 bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><FileCheck2 size={16} />Account status</h3>
            <form onSubmit={saveStatus} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option>Pending</option><option>Active</option><option>Suspended</option></select></label>
              <Field label="Reason / remarks" value={statusReason} onChange={setStatusReason} placeholder="Optional" />
              <button disabled={busyAction === 'status'} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busyAction === 'status' ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Update</button>
            </form>
          </section>

          <section className="border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><FileText size={16} />KYC documents</h3><p className="mt-1 text-xs text-slate-500">Optional private files · PDF, JPEG or PNG · 5 MB maximum</p></div>
              <Badge tone={documentsVerified ? 'green' : 'amber'}>{kycDocuments.length === 0 ? 'Optional documents not uploaded' : documentsVerified ? 'Documents verified' : 'Documents need review'}</Badge>
            </div>
            <label className="mt-3 block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Document review remarks</span><input value={documentRemarks} onChange={(event) => setDocumentRemarks(event.target.value)} maxLength={500} placeholder="Required when rejecting a document" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
            <div className="mt-3 divide-y divide-slate-100">
              {kycDocuments.length ? kycDocuments.map((document) => (
                <article key={document._id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600"><FileText size={16} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold text-slate-900">{labelDocumentType(document.documentType)}</p><Badge tone={toneFor(document.status)}>{document.status}</Badge></div><p className="mt-1 max-w-[19rem] truncate text-xs text-slate-600">{document.originalName} · {formatBytes(document.size)}</p><p className="mt-1 text-[11px] text-slate-500">Uploaded {formatDate(document.createdAt)}{document.reviewedAt ? ` · Reviewed ${formatDate(document.reviewedAt)}` : ''}</p>{document.remarks && <p className="mt-1 text-xs text-rose-700">{document.remarks}</p>}</div></div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => downloadFile(`/customers/management/${customer._id}/kyc/documents/${document._id}/download`, document.originalName).catch(onError)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download size={13} />Download</button>
                    {document.status === 'Pending' && <><button type="button" disabled={busyAction === `document-${document._id}`} onClick={() => reviewDocument(document._id, 'Verified')} className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Verify</button><button type="button" disabled={busyAction === `document-${document._id}`} onClick={() => reviewDocument(document._id, 'Rejected')} className="rounded-md border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50">Reject</button></>}
                  </div>
                </article>
              )) : <p className="py-5 text-center text-xs text-slate-500">No KYC documents uploaded yet.</p>}
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck size={16} />KYC review</h3><Badge tone={toneFor(customer.kycStatus)}>{customer.kycStatus || 'NotSubmitted'}</Badge></div>
            <p className="mt-2 text-xs text-slate-500">Submitted {formatDate(customer.kycSubmittedAt)} · Reviewed {formatDate(customer.kycReviewedAt)}</p>
            {customer.kycReviewedBy && <p className="mt-1 text-xs text-slate-500">Reviewer: {customer.kycReviewedBy}</p>}
            <label className="mt-3 block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Review remarks</span><textarea value={kycRemarks} onChange={(event) => setKycRemarks(event.target.value)} maxLength={500} rows="2" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={customer.kycStatus !== 'Pending' || !documentsVerified || busyAction === 'kyc'} onClick={() => reviewKyc('Verified')} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"><BadgeCheck size={14} />Approve KYC</button>
              <button type="button" disabled={customer.kycStatus !== 'Pending' || busyAction === 'kyc'} onClick={() => reviewKyc('Rejected')} className="inline-flex items-center gap-2 rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"><X size={14} />Reject KYC</button>
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><MessageSquare size={16} />Activity & communication</h3>
            <form onSubmit={createActivity} className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Activity type</span><select value={activityType} onChange={(event) => setActivityType(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="sms">SMS</option><option value="follow_up">Follow-up</option></select></label>
                <Field label="Subject" value={activitySubject} onChange={setActivitySubject} placeholder="Short summary" />
              </div>
              {activityType === 'follow_up' && <Field label="Follow-up date and time" type="datetime-local" value={followUpAt} onChange={setFollowUpAt} />}
              <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Details</span><textarea value={activityDescription} onChange={(event) => setActivityDescription(event.target.value)} maxLength={2000} rows="2" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
              <button disabled={busyAction === 'activity' || !activitySubject.trim() || (activityType === 'follow_up' && !followUpAt)} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{busyAction === 'activity' ? <LoaderCircle size={14} className="animate-spin" /> : <Activity size={14} />}Record activity</button>
            </form>
            <div className="mt-5 border-t border-slate-200 pt-2">
              {activities.length ? activities.map((item) => (
                <article key={item._id} className="border-b border-slate-100 py-3 last:border-0">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold text-slate-800">{item.subject}</p><p className="mt-1 text-[11px] text-slate-500">{item.type.replaceAll('_', ' ')} · {formatDate(item.createdAt)}</p></div>
                    {item.type === 'follow_up' && (item.followUpCompletedAt ? <Badge tone="green"><Check size={11} />Completed</Badge> : <button type="button" onClick={() => performAction(`follow-${item._id}`, () => apiRequest(`/customers/management/${customer._id}/activities/${item._id}/complete`, { method: 'PATCH', body: {} }))} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"><CalendarClock size={12} />Complete</button>)}
                  </div>
                  {item.followUpAt && <p className="mt-1 text-[11px] font-medium text-amber-800">Due {formatDate(item.followUpAt)}</p>}
                  {item.description && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{item.description}</p>}
                </article>
              )) : <p className="py-5 text-center text-xs text-slate-500">No activity recorded yet.</p>}
            </div>
          </section>
        </div>
      </section>
      {loginOpen && (
        <LoginAccessDialog
          role="customer"
          profileId={customer._id}
          personName={customer.companyName || customer.contactPerson || customer.phone}
          suggestedLoginId={customer.phone || ''}
          onClose={() => setLoginOpen(false)}
        />
      )}
    </div>
  );
}

export default function CustomerManagement() {
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activities, setActivities] = useState([]);
  const [kycDocuments, setKycDocuments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setSearch(searchDraft.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (kycFilter) params.set('kycStatus', kycFilter);
    setLoading(true);
    setPageError('');
    Promise.all([apiRequest('/customers/management/summary'), apiRequest(`/customers/management?${params}`)])
      .then(([nextSummary, result]) => {
        if (!active) return;
        setSummary(nextSummary); setCustomers(result.customers || []); setPagination(result.pagination || { page: 1, totalPages: 1, total: 0 });
      })
      .catch((error) => {
        if (!active) return;
        setPageError(error.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, statusFilter, kycFilter, search, refreshKey]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;
    setDetailLoading(true);
    Promise.all([
      apiRequest(`/customers/management/${selectedId}`),
      apiRequest(`/customers/management/${selectedId}/activities?limit=50`),
      apiRequest(`/customers/management/${selectedId}/kyc/documents`)
    ])
      .then(([customer, result, documents]) => { if (active) { setSelectedCustomer(customer); setActivities(result.activities || []); setKycDocuments(documents || []); } })
      .catch((error) => {
        if (!active) return;
        setPageError(error.message);
      })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId, refreshKey]);

  function handleApiError(error) {
    setPageError(error.message);
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />Customer operations
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-950">Customer management</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-600">Manage customer accounts, review KYC submissions and keep every follow-up traceable.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh</button>
        </div>
      </header>
      {pageError && <div role="alert" className="flex items-start gap-2 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{pageError}</div>}
      {notice && <div role="status" className="flex items-center justify-between border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5" aria-label="Customer summary">
        <Metric label="All customers" value={summary?.total} icon={Users} active={!statusFilter && !kycFilter} onClick={() => { setStatusFilter(''); setKycFilter(''); setPage(1); }} />
        <Metric label="Active accounts" value={summary?.active} icon={BadgeCheck} active={statusFilter === 'Active'} onClick={() => { setStatusFilter('Active'); setKycFilter(''); setPage(1); }} />
        <Metric label="Pending accounts" value={summary?.pending} icon={Clock3} tone="amber" active={statusFilter === 'Pending'} onClick={() => { setStatusFilter('Pending'); setKycFilter(''); setPage(1); }} />
        <Metric label="KYC to review" value={summary?.kycPending} icon={FileCheck2} tone="blue" active={kycFilter === 'Pending'} onClick={() => { setStatusFilter(''); setKycFilter('Pending'); setPage(1); }} />
        <Metric label="Suspended" value={summary?.suspended} icon={ShieldCheck} tone="red" active={statusFilter === 'Suspended'} onClick={() => { setStatusFilter('Suspended'); setKycFilter(''); setPage(1); }} />
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Customer directory</h2>
            <p className="mt-1 text-xs text-slate-500">
              Showing {customers.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, pagination.total || 0)} of {pagination.total || 0} records
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:min-w-[44rem] xl:grid-cols-[minmax(14rem,1fr)_12rem_12rem_auto]">
            <label className="relative block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search name, phone, email" className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter by account status" className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100">
              <option value="">All account statuses</option><option value="Pending">Pending</option><option value="Active">Active</option><option value="Suspended">Suspended</option>
            </select>
            <select value={kycFilter} onChange={(event) => { setKycFilter(event.target.value); setPage(1); }} aria-label="Filter by KYC status" className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100">
              <option value="">All KYC statuses</option><option value="NotSubmitted">Not submitted</option><option value="Pending">KYC pending</option><option value="Verified">Verified</option><option value="Rejected">Rejected</option>
            </select>
            {(searchDraft || statusFilter || kycFilter) && <button type="button" onClick={() => { setSearchDraft(''); setSearch(''); setStatusFilter(''); setKycFilter(''); setPage(1); }} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Clear</button>}
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[940px] text-left">
            <thead><tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500"><th className="px-5 py-3.5">Customer</th><th className="px-4 py-3.5">Primary contact</th><th className="px-4 py-3.5">Location</th><th className="px-4 py-3.5">Account</th><th className="px-4 py-3.5">KYC review</th><th className="px-4 py-3.5">Last active</th><th className="px-3 py-3.5"><span className="sr-only">Open record</span></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !customers.length ? <tr><td colSpan="7" className="px-4 py-16 text-center text-sm text-slate-500"><LoaderCircle size={20} className="mx-auto mb-2 animate-spin text-emerald-700" />Loading customer records…</td></tr> : customers.length ? customers.map((customer) => {
                const name = customer.companyName || customer.contactPerson || 'Unnamed customer';
                return (
                  <tr key={customer._id} className="group transition-colors hover:bg-emerald-50/40">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e6f0ed] text-xs font-bold text-[#1d5b4d]">{getInitials(name)}</span>
                        <div className="min-w-0"><button type="button" onClick={() => { setSelectedId(customer._id); setSelectedCustomer(null); setPageError(''); }} className="block max-w-[15rem] truncate text-left text-sm font-bold text-slate-900 hover:text-emerald-800">{name}</button><span className="mt-1 block font-mono text-[11px] text-slate-500">{shortId(customer._id)}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><span className="block text-sm font-medium text-slate-800">{customer.contactPerson || '—'}</span><span className="mt-1 block text-xs text-slate-500">{customer.phone}</span></td>
                    <td className="px-4 py-4 text-sm text-slate-600">{[customer.address?.city, customer.address?.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-4"><Badge tone={toneFor(customer.status)}>{customer.status}</Badge></td>
                    <td className="px-4 py-4"><Badge tone={toneFor(customer.kycStatus)}>{customer.kycStatus || 'NotSubmitted'}</Badge></td>
                    <td className="px-4 py-4 text-xs text-slate-600">{formatDate(customer.lastActiveAt)}</td>
                    <td className="px-3 py-4"><button type="button" onClick={() => { setSelectedId(customer._id); setSelectedCustomer(null); setPageError(''); }} aria-label={`Open ${name}`} className="rounded-md p-2 text-slate-500 opacity-70 transition hover:bg-slate-200 hover:text-slate-900 group-hover:opacity-100"><ChevronRight size={17} /></button></td>
                  </tr>
                );
              }) : <tr><td colSpan="7" className="px-4 py-16 text-center"><Users size={24} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-semibold text-slate-800">No customers match these filters</p><p className="mt-1 text-sm text-slate-500">Clear a filter or try a different search.</p></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-200 md:hidden">
          {loading && !customers.length ? <div className="px-4 py-12 text-center text-sm text-slate-500"><LoaderCircle size={20} className="mx-auto mb-2 animate-spin text-emerald-700" />Loading customer records…</div> : customers.length ? customers.map((customer) => {
            const name = customer.companyName || customer.contactPerson || 'Unnamed customer';
            return (
              <button key={customer._id} type="button" onClick={() => { setSelectedId(customer._id); setSelectedCustomer(null); setPageError(''); }} className="block w-full px-4 py-4 text-left transition hover:bg-emerald-50/40">
                <span className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e6f0ed] text-xs font-bold text-[#1d5b4d]">{getInitials(name)}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-900">{name}</span><span className="mt-1 block font-mono text-[11px] text-slate-500">{shortId(customer._id)}</span></span></span><ChevronRight size={17} className="shrink-0 text-slate-400" /></span>
                <span className="mt-3 flex flex-wrap items-center gap-2"><Badge tone={toneFor(customer.status)}>{customer.status}</Badge><Badge tone={toneFor(customer.kycStatus)}>{customer.kycStatus || 'NotSubmitted'}</Badge><span className="text-xs text-slate-500">{customer.phone}</span></span>
                <span className="mt-2 block text-xs text-slate-600">{customer.contactPerson || 'No contact'} · {[customer.address?.city, customer.address?.state].filter(Boolean).join(', ') || 'No location'}</span>
              </button>
            );
          }) : <div className="px-4 py-12 text-center"><Users size={24} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-semibold text-slate-800">No customers match these filters</p><p className="mt-1 text-sm text-slate-500">Clear a filter or try a different search.</p></div>}
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs font-medium text-slate-500">Page {pagination.page || page} of {pagination.totalPages || 1}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} />Previous</button>
            <button type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages || 1, current + 1))} disabled={page >= (pagination.totalPages || 1) || loading} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={14} /></button>
          </div>
        </footer>
      </section>

      {selectedCustomer && <CustomerDetail customer={selectedCustomer} activities={activities} kycDocuments={kycDocuments} loading={detailLoading} onClose={() => { setSelectedId(''); setSelectedCustomer(null); }} onChanged={() => { setNotice('Customer record updated.'); setPageError(''); setRefreshKey((current) => current + 1); }} onError={handleApiError} />}
    </div>
  );
}