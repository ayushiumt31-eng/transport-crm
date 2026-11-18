import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, LoaderCircle, MessageSquare, RefreshCw, Send, Star } from 'lucide-react';
import { apiFetch } from '../../auth/session';
import { useAuth } from '../../auth/AuthContext';

const categories = ['Service', 'Driver', 'Vehicle', 'Delivery', 'Other'];
const statuses = ['Open', 'InReview', 'Resolved'];

async function feedbackRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

function FeedbackManagement() {
  const { role } = useAuth();
  const isStaff = role === 'admin' || role === 'manager';
  const [feedback, setFeedback] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [drafts, setDrafts] = useState({});
  const [draft, setDraft] = useState({ shipmentId: '', category: 'Service', rating: '5', subject: '', message: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [page, search, statusFilter]);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await feedbackRequest(`/customers/feedback?${query}`);
      setFeedback(result.data || []);
      setPagination(result.pagination || { total: 0, page, totalPages: 0 });
      if (isStaff) setSummary(await feedbackRequest('/customers/feedback/summary'));
    } catch (requestError) {
      setFeedback([]);
      setSummary(null);
      setPagination({ total: 0, page, totalPages: 0 });
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [isStaff, page, query]);

  const loadEligibleShipments = useCallback(async () => {
    if (isStaff) return;
    try {
      setShipments(await feedbackRequest('/customers/feedback/options/shipments'));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [isStaff]);

  useEffect(() => { loadFeedback(); }, [loadFeedback]);
  useEffect(() => { loadEligibleShipments(); }, [loadEligibleShipments]);

  async function submitFeedback(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await feedbackRequest('/customers/feedback', {
        method: 'POST',
        body: { ...draft, rating: Number(draft.rating) }
      });
      setNotice('Feedback submitted. Thank you for sharing your experience.');
      setDraft({ shipmentId: '', category: 'Service', rating: '5', subject: '', message: '' });
      setPage(1);
      await Promise.all([loadEligibleShipments(), loadFeedback()]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateFeedback(item) {
    const currentDraft = drafts[item._id] || {};
    const status = currentDraft.status || item.status;
    const staffResponse = currentDraft.staffResponse ?? item.staffResponse ?? '';
    setBusyId(item._id);
    setError('');
    setNotice('');
    try {
      await feedbackRequest(`/customers/feedback/${encodeURIComponent(item._id)}`, {
        method: 'PATCH',
        body: { status, staffResponse }
      });
      setNotice(`Feedback ${item.consignmentNumber} updated.`);
      await loadFeedback();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><MessageSquare size={22} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Customer Management</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Feedback Management</h1>
            <p className="mt-1 text-sm text-slate-600">{isStaff ? 'Review delivery feedback and send customer-facing responses.' : 'Share feedback after a shipment has been delivered.'}</p>
          </div>
        </div>
        <button type="button" onClick={() => { loadFeedback(); loadEligibleShipments(); }} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
      </header>

      <div role="note" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
        Customers can submit one feedback record per owned delivered shipment with proof of delivery. Staff responses are visible to the customer.
      </div>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><Check size={15} />{notice}</div>}

      {isStaff && summary && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Total feedback', summary.total],
            ['Average rating', `${Number(summary.averageRating).toFixed(2)} / 5`],
            ['Open', summary.open],
            ['In review', summary.inReview],
            ['Resolved', summary.resolved]
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">{value}</p></div>)}
        </section>
      )}

      {!isStaff && (
        <form onSubmit={submitFeedback} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Submit shipment feedback</h2>
          {shipments.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">No eligible delivered shipments are waiting for feedback.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">Delivered shipment<select required value={draft.shipmentId} onChange={(event) => setDraft((current) => ({ ...current, shipmentId: event.target.value }))} className={inputClass}><option value="">Select a delivered shipment</option>{shipments.map((shipment) => <option key={shipment._id} value={shipment._id}>{shipment.consignmentNumber} · {shipment.bookingNumber} · {shipment.goodsType}</option>)}</select></label>
                <label className="text-xs font-semibold text-slate-600">Category<select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className={inputClass}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label className="text-xs font-semibold text-slate-600">Rating<select value={draft.rating} onChange={(event) => setDraft((current) => ({ ...current, rating: event.target.value }))} className={inputClass}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
                <label className="text-xs font-semibold text-slate-600">Subject<input required minLength={3} maxLength={150} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} className={inputClass} /></label>
              </div>
              <label className="block text-xs font-semibold text-slate-600">Your feedback<textarea required minLength={5} maxLength={2000} rows={4} value={draft.message} onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} className={inputClass} /></label>
              <button type="submit" disabled={saving || shipments.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}Submit feedback</button>
            </>
          )}
        </form>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">Search<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Consignment, booking or subject" className={inputClass} /></label>
          <label className="text-xs font-semibold text-slate-600">Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className={inputClass}><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <span className="pb-2 text-xs text-slate-500">{pagination.total} total records</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />Loading feedback…</div>
        ) : feedback.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No feedback found.</p>
        ) : (
          <div className="space-y-3">
            {feedback.map((item) => (
              <article key={item._id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.consignmentNumber} · Booking {item.bookingNumber}</p>
                    <h2 className="mt-1 text-sm font-bold text-slate-900">{item.subject}</h2>
                    <p className="mt-1 text-xs text-slate-600">{item.category} · {new Date(item.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"><Star size={13} />{item.rating} / 5 · {item.status}</div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message}</p>
                {item.staffResponse && <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Response from our team</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-emerald-950">{item.staffResponse}</p></div>}
                {isStaff && (
                  <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-[0.5fr_1fr_auto] sm:items-end">
                    <label className="text-xs font-semibold text-slate-600">Status<select value={drafts[item._id]?.status || item.status} onChange={(event) => setDrafts((current) => ({ ...current, [item._id]: { ...current[item._id], status: event.target.value } }))} className={inputClass}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                    <label className="text-xs font-semibold text-slate-600">Customer-facing response<textarea rows={2} maxLength={2000} value={drafts[item._id]?.staffResponse ?? item.staffResponse ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [item._id]: { ...current[item._id], staffResponse: event.target.value } }))} className={inputClass} /></label>
                    <button type="button" disabled={busyId === item._id} onClick={() => updateFeedback(item)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busyId === item._id ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Save review</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-slate-100 pt-3"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><ChevronLeft size={14} />Previous</button><span className="text-xs text-slate-500">Page {page} of {pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">Next<ChevronRight size={14} /></button></div>}
      </section>
    </div>
  );
}

export default FeedbackManagement;
