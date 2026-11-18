import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BadgeIndianRupee, Check, ChevronDown, ChevronUp, FileText, LoaderCircle, Plus, Printer, RefreshCw, Search, Wallet, X } from 'lucide-react';
import { apiFetch } from '../../auth/session';
import { useAuth } from '../../auth/AuthContext';

const pageDetails = {
  '/billing/invoices': {
    title: 'Invoices',
    description: 'Issue invoices only after delivery and POD; review customer balances and payment history.'
  },
  '/billing/payments': {
    title: 'Payment collection',
    description: 'Record payments received by the business and review receipts. Customer portal history is read-only.'
  },
  '/billing/reports': {
    title: 'Financial reports',
    description: 'Review billed, collected and outstanding amounts from recorded invoices and receipts.'
  }
};

const invoiceStatusLabels = {
  Issued: 'Issued',
  PartiallyPaid: 'Partially paid',
  Paid: 'Paid',
  Overdue: 'Overdue',
  Cancelled: 'Cancelled'
};

const methods = ['BankTransfer', 'UPI', 'Card', 'Cash', 'Cheque', 'Other'];

async function billingRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

function localDateValue(value = new Date()) {
  const adjusted = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function rupees(paise) {
  const value = Number(paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
}

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function addressText(address = {}) {
  return [address.street, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join(', ') || '—';
}

function statusTone(status) {
  if (status === 'Paid') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'PartiallyPaid') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (status === 'Overdue') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (status === 'Cancelled') return 'border-slate-200 bg-slate-100 text-slate-600';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function initialInvoiceDraft() {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  return {
    shipmentId: '',
    invoiceDate: localDateValue(today),
    dueDate: localDateValue(due),
    taxRatePercent: '0',
    items: [{ description: 'Transport service', quantity: '1', unitPrice: '' }]
  };
}

function printInvoice(invoice) {
  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) {
    window.alert('Allow pop-ups to print this invoice.');
    return;
  }
  popup.opener = null;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const items = invoice.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.description)}</td>
      <td>${(item.quantityMilli / 1000).toFixed(3).replace(/\.?0+$/, '')}</td>
      <td>${rupees(item.unitPricePaise)}</td>
      <td>${rupees(item.lineTotalPaise)}</td>
    </tr>`).join('');
  popup.document.write(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(invoice.invoiceNumber)}</title>
        <style>
          body{font:14px Arial,sans-serif;color:#172033;max-width:900px;margin:40px auto;padding:0 24px}
          h1{margin-bottom:4px}small,.muted{color:#64748b}section{margin:28px 0}
          table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #e2e8f0}
          th:last-child,td:last-child{text-align:right}.totals{margin-left:auto;width:320px}
          .row{display:flex;justify-content:space-between;padding:6px 0}.grand{border-top:2px solid #172033;font-size:18px;font-weight:bold}
          @media print{body{margin:0 auto}}
        </style>
      </head>
      <body>
        <h1>Transport invoice</h1>
        <small>Internal billing record · Not a statutory GST tax invoice or e-invoice</small>
        <section>
          <strong>${escapeHtml(invoice.invoiceNumber)}</strong><br>
          Invoice date: ${escapeHtml(new Date(invoice.invoiceDate).toLocaleDateString())}<br>
          Due date: ${escapeHtml(new Date(invoice.dueDate).toLocaleDateString())}<br>
          Status: ${escapeHtml(invoiceStatusLabels[invoice.invoiceStatus] || invoice.invoiceStatus)}
        </section>
        <section>
          <strong>Bill to: ${escapeHtml(invoice.customerSnapshot.companyName || invoice.customerSnapshot.name)}</strong><br>
          ${escapeHtml(addressText(invoice.customerSnapshot.billingAddress))}<br>
          Phone: ${escapeHtml(invoice.customerSnapshot.phone)}<br>
          ${invoice.customerSnapshot.gstin ? `Customer GSTIN: ${escapeHtml(invoice.customerSnapshot.gstin)}<br>` : ''}
          Booking: ${escapeHtml(invoice.bookingNumber)} · Consignment: ${escapeHtml(invoice.consignmentNumber)}
        </section>
        <table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${items}</tbody></table>
        <section class="totals">
          <div class="row"><span>Subtotal</span><strong>${rupees(invoice.subtotalPaise)}</strong></div>
          <div class="row"><span>Tax (${(invoice.taxRateBasisPoints / 100).toFixed(2)}%)</span><strong>${rupees(invoice.taxPaise)}</strong></div>
          <div class="row grand"><span>Total</span><strong>${rupees(invoice.totalPaise)}</strong></div>
          <div class="row"><span>Paid</span><strong>${rupees(invoice.amountPaidPaise)}</strong></div>
          <div class="row"><span>Balance due</span><strong>${rupees(invoice.totalPaise - invoice.amountPaidPaise)}</strong></div>
        </section>
        <script>window.addEventListener('load',()=>window.print());</script>
      </body>
    </html>`);
  popup.document.close();
}

function InvoiceForm({ shipments, onClose, onSubmit, saving }) {
  const [draft, setDraft] = useState(initialInvoiceDraft);
  const [formError, setFormError] = useState('');
  const selectedShipment = shipments.find((shipment) => shipment._id === draft.shipmentId);
  const acceptedQuote = selectedShipment?.booking?.quote?.status === 'Accepted'
    ? selectedShipment.booking.quote
    : null;

  function updateItem(index, field, value) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    try {
      await onSubmit({
        ...draft,
        taxRatePercent: Number(draft.taxRatePercent),
        items: draft.items.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice)
        }))
      });
    } catch (error) {
      setFormError(error.message);
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="invoice-form-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="invoice-form-title" className="text-lg font-bold text-slate-900">Issue a delivery invoice</h2>
            <p className="mt-1 text-xs text-slate-500">Only delivered consignments with POD can be invoiced.</p>
          </div>
          <button type="button" aria-label="Close invoice form" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={17} /></button>
        </header>
        <form onSubmit={submit} className="space-y-5 p-5">
          {formError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{formError}</p>}
          <label className="block text-[10px] font-semibold text-slate-600">
            Delivered shipment
            <select required value={draft.shipmentId} onChange={(event) => {
              const shipmentId = event.target.value;
              const quote = shipments.find((shipment) => shipment._id === shipmentId)?.booking?.quote;
              setDraft((current) => ({
                ...current,
                shipmentId,
                ...(quote?.status === 'Accepted' ? {
                  taxRatePercent: '0',
                  items: quote.items.map((item) => ({
                    description: item.description,
                    quantity: String(item.quantityMilli / 1000),
                    unitPrice: String(item.unitPricePaise / 100)
                  }))
                } : {})
              }));
            }} className={inputClass}>
              <option value="">Select a delivered shipment</option>
              {shipments.map((shipment) => <option key={shipment._id} value={shipment._id}>{shipment.consignmentNumber} · {shipment.booking.bookingNumber} · {shipment.booking.cargo?.goodsType || 'Cargo'}</option>)}
            </select>
          </label>
          {selectedShipment && (
            <div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-2">
              <p><span className="text-slate-500">Customer:</span> <strong>{selectedShipment.booking.customerId?.companyName || selectedShipment.booking.customerId?.contactPerson || selectedShipment.booking.customerId?.phone || 'Customer'}</strong></p>
              <p><span className="text-slate-500">Delivery:</span> <strong>{addressText(selectedShipment.booking.deliveryAddress)}</strong></p>
              <p><span className="text-slate-500">Delivered:</span> <strong>{new Date(selectedShipment.deliveredAt).toLocaleString()}</strong></p>
              <p><span className="text-slate-500">Consignment:</span> <strong>{selectedShipment.consignmentNumber}</strong></p>
            </div>
          )}
          {acceptedQuote && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">Invoice charge lines will use the customer-accepted quote v{acceptedQuote.version} ({rupees(acceptedQuote.totalPaise)}). Quote amounts cannot be changed here.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-[10px] font-semibold text-slate-600">Invoice date<input required type="date" value={draft.invoiceDate} onChange={(event) => setDraft((current) => ({ ...current, invoiceDate: event.target.value }))} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Payment due date<input required type="date" min={draft.invoiceDate} value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} className={inputClass} /></label>
            <label className="text-[10px] font-semibold text-slate-600">Tax rate (%)<input type="number" min="0" max="100" step="0.01" value={acceptedQuote ? '0' : draft.taxRatePercent} onChange={(event) => setDraft((current) => ({ ...current, taxRatePercent: event.target.value }))} className={inputClass} disabled={Boolean(acceptedQuote)} /></label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800">Charge lines (INR)</h3>
              <button type="button" disabled={Boolean(acceptedQuote) || draft.items.length >= 50} onClick={() => setDraft((current) => ({ ...current, items: [...current.items, { description: '', quantity: '1', unitPrice: '' }] }))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 disabled:opacity-40"><Plus size={12} />Add line</button>
            </div>
            {draft.items.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[1fr_0.55fr_0.75fr_auto] sm:items-end">
                <label className="text-[10px] font-semibold text-slate-600">Description<input required minLength={2} maxLength={200} value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} className={inputClass} disabled={Boolean(acceptedQuote)} /></label>
                <label className="text-[10px] font-semibold text-slate-600">Quantity<input required type="number" min="0.001" max="100000" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} className={inputClass} disabled={Boolean(acceptedQuote)} /></label>
                <label className="text-[10px] font-semibold text-slate-600">Rate per unit<input required type="number" min="0" max="100000000" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} className={inputClass} disabled={Boolean(acceptedQuote)} /></label>
                <button type="button" disabled={acceptedQuote || draft.items.length === 1} aria-label={`Remove charge line ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 disabled:opacity-40">Remove</button>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">
            GST setup is optional; the internal invoice can be issued without it. GST classification, statutory tax-invoice fields, e-invoicing/IRN, and payment-gateway collection are not configured or connected here. Do not treat this screen as a compliant GST tax invoice.
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} />}Issue invoice</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function BillingManagement({ path }) {
  const page = pageDetails[path] || pageDetails['/billing/invoices'];
  const { role } = useAuth();
  const isStaff = role === 'admin' || role === 'manager';
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [openInvoice, setOpenInvoice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(pageNumber), limit: '20' });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [pageNumber, search, statusFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (path === '/billing/reports') {
        const [summaryResponse, invoiceResponse, paymentResponse] = await Promise.all([
          billingRequest('/billing/reports/summary'),
          billingRequest(`/billing/invoices?${query}`),
          billingRequest(`/billing/payments?${query}`)
        ]);
        setSummary(summaryResponse);
        setInvoices(invoiceResponse.data || []);
        setPayments(paymentResponse.data || []);
        setPagination(invoiceResponse.pagination || { total: 0, page: pageNumber, totalPages: 0 });
      } else if (path === '/billing/payments') {
        const result = await billingRequest(`/billing/payments?${query}`);
        setPayments(result.data || []);
        setPagination(result.pagination || { total: 0, page: pageNumber, totalPages: 0 });
      } else {
        const result = await billingRequest(`/billing/invoices?${query}`);
        setInvoices(result.data || []);
        setPagination(result.pagination || { total: 0, page: pageNumber, totalPages: 0 });
      }
    } catch (requestError) {
      setInvoices([]);
      setPayments([]);
      setSummary(null);
      setPagination({ total: 0, page: pageNumber, totalPages: 0 });
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [path, query, pageNumber]);

  const loadInvoiceOptions = useCallback(async () => {
    if (!isStaff || path !== '/billing/invoices') return;
    try {
      const result = await billingRequest('/billing/options/shipments?page=1&limit=100');
      setShipments(result.data || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [isStaff, path]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadInvoiceOptions(); }, [loadInvoiceOptions]);

  async function createInvoice(payload) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await billingRequest('/billing/invoices', { method: 'POST', body: payload });
      setNotice(`Invoice ${result.invoiceNumber} issued.`);
      setFormOpen(false);
      await Promise.all([loadData(), loadInvoiceOptions()]);
    } finally {
      setSaving(false);
    }
  }

  async function recordPayment(invoice) {
    const draft = paymentDrafts[invoice._id] || {};
    if (!draft.amount || Number(draft.amount) <= 0) {
      setError('Enter a payment amount greater than zero.');
      return;
    }
    setBusyId(invoice._id);
    setError('');
    setNotice('');
    try {
      await billingRequest(`/billing/invoices/${encodeURIComponent(invoice._id)}/payments`, {
        method: 'POST',
        body: {
          idempotencyKey: window.crypto.randomUUID(),
          amount: Number(draft.amount),
          method: draft.method || 'BankTransfer',
          transactionReference: draft.transactionReference || '',
          notes: draft.notes || '',
          paidAt: new Date().toISOString()
        }
      });
      setNotice(`Payment recorded against ${invoice.invoiceNumber}.`);
      setPaymentDrafts((current) => ({ ...current, [invoice._id]: {} }));
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  async function cancelInvoice(invoice) {
    const remarks = window.prompt(`Why are you cancelling ${invoice.invoiceNumber}? This cannot be undone.`);
    if (!remarks?.trim()) return;
    setBusyId(invoice._id);
    setError('');
    setNotice('');
    try {
      await billingRequest(`/billing/invoices/${encodeURIComponent(invoice._id)}/cancel`, {
        method: 'PATCH',
        body: { remarks: remarks.trim() }
      });
      setNotice(`Invoice ${invoice.invoiceNumber} cancelled.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  function updatePaymentDraft(invoiceId, field, value) {
    setPaymentDrafts((current) => ({
      ...current,
      [invoiceId]: { ...current[invoiceId], [field]: value }
    }));
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600';

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><BadgeIndianRupee size={22} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Billing & accounting</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{page.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{page.description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {path === '/billing/invoices' && isStaff && (
            <button type="button" onClick={() => setFormOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-800"><Plus size={14} />Issue invoice</button>
          )}
          <button type="button" onClick={() => { loadData(); loadInvoiceOptions(); }} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
        </div>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">
        Internal billing workflow only. GST setup is optional and does not block internal invoices. GST tax classification/statutory invoice requirements, e-invoice IRN, branch seller details and payment gateway are not configured or connected.
      </div>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><Check size={15} />{notice}</div>}

      {path === '/billing/reports' && isStaff && summary && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Invoices issued', summary.invoiceCount],
            ['Billed', rupees(summary.billedPaise)],
            ['Payments recorded', rupees(summary.collectedPaise)],
            ['Outstanding', rupees(summary.outstandingPaise)]
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">{value}</p></div>)}
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:col-span-2 xl:col-span-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Overdue invoices</p>
            <p className="mt-1 text-xl font-bold text-rose-900">{summary.overdueInvoices}</p>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="relative min-w-0 flex-1 text-[10px] font-semibold text-slate-500">
          <span className="mb-1 block">Search {path === '/billing/payments' ? 'receipts' : 'invoices'}</span>
          <Search size={14} className="absolute bottom-3 left-3 text-slate-400" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPageNumber(1); }} className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-emerald-600" placeholder="Invoice, receipt, customer, booking…" />
        </label>
        {path !== '/billing/payments' && (
          <label className="text-[10px] font-semibold text-slate-500">
            <span className="mb-1 block">Invoice status</span>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPageNumber(1); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs sm:w-48">
              <option value="">All statuses</option>
              {Object.entries(invoiceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}
        <p className="text-xs text-slate-500">{pagination.total} total records</p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500"><LoaderCircle size={18} className="mx-auto mb-2 animate-spin text-emerald-700" />Loading billing records…</div>
      ) : path === '/billing/payments' ? (
        payments.length ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[780px] text-left">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Receipt</th><th className="px-4 py-3">Invoice / consignment</th>{isStaff && <th className="px-4 py-3">Customer</th>}<th className="px-4 py-3">Paid at</th><th className="px-4 py-3">Method / reference</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => <tr key={payment._id} className="text-xs">
                  <td className="px-4 py-4 font-bold text-slate-900">{payment.receiptNumber}</td>
                  <td className="px-4 py-4"><p className="font-semibold text-slate-800">{payment.invoiceNumber}</p><p className="mt-1 text-[10px] text-slate-500">{payment.consignmentNumber} · {payment.bookingNumber}</p></td>
                  {isStaff && <td className="px-4 py-4 text-slate-700">{payment.customerName}</td>}
                  <td className="px-4 py-4 text-slate-600">{dateTime(payment.paidAt)}</td>
                  <td className="px-4 py-4 text-slate-600">{payment.method}{payment.transactionReference && <p className="mt-1 text-[10px]">{payment.transactionReference}</p>}</td>
                  <td className="px-4 py-4 text-right font-bold text-slate-900">{rupees(payment.amountPaise)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        ) : <EmptyState isPayment title="No payment receipts" />
      ) : invoices.length ? (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const balancePaise = invoice.totalPaise - invoice.amountPaidPaise;
            const draft = paymentDrafts[invoice._id] || {};
            const canRecord = isStaff && balancePaise > 0 && invoice.invoiceStatus !== 'Cancelled';
            const expanded = openInvoice === invoice._id;
            return (
              <article key={invoice._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900">{invoice.invoiceNumber}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${statusTone(invoice.invoiceStatus)}`}>{invoiceStatusLabels[invoice.invoiceStatus] || invoice.invoiceStatus}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{invoice.customerSnapshot.companyName || invoice.customerSnapshot.name} · {invoice.consignmentNumber}</p>
                    <p className="mt-1 text-[10px] text-slate-500">Booking {invoice.bookingNumber} · Issued {dateTime(invoice.invoiceDate)} · Due {dateTime(invoice.dueDate)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <div className="text-right"><p className="text-[9px] font-bold uppercase text-slate-400">Invoice total</p><p className="text-base font-bold text-slate-900">{rupees(invoice.totalPaise)}</p></div>
                    <div className="text-right"><p className="text-[9px] font-bold uppercase text-slate-400">Balance</p><p className="text-base font-bold text-emerald-800">{rupees(balancePaise)}</p></div>
                    <button type="button" onClick={() => printInvoice(invoice)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"><Printer size={13} />Print</button>
                    <button type="button" onClick={() => setOpenInvoice(expanded ? '' : invoice._id)} aria-label={expanded ? 'Hide invoice details' : 'Show invoice details'} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-4 border-t border-slate-100 p-4 sm:p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3 text-xs"><p className="font-bold text-slate-700">Bill to</p><p className="mt-1 font-semibold text-slate-900">{invoice.customerSnapshot.companyName || invoice.customerSnapshot.name}</p><p className="mt-1 text-slate-600">{addressText(invoice.customerSnapshot.billingAddress)}</p><p className="mt-1 text-slate-600">{invoice.customerSnapshot.phone}{invoice.customerSnapshot.email ? ` · ${invoice.customerSnapshot.email}` : ''}</p></div>
                      <div className="rounded-xl bg-slate-50 p-3 text-xs"><p className="font-bold text-slate-700">Payment summary</p><p className="mt-1 text-slate-600">Paid: {rupees(invoice.amountPaidPaise)}</p><p className="mt-1 text-slate-600">Outstanding: {rupees(balancePaise)}</p><p className="mt-1 text-slate-600">Tax rate: {(invoice.taxRateBasisPoints / 100).toFixed(2)}%</p></div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-xs">
                        <thead className="border-b border-slate-200 text-[9px] font-bold uppercase text-slate-400"><tr><th className="py-2">Description</th><th className="py-2">Quantity</th><th className="py-2">Rate</th><th className="py-2 text-right">Amount</th></tr></thead>
                        <tbody>{invoice.items.map((item, index) => <tr key={`${invoice._id}-${index}`} className="border-b border-slate-100"><td className="py-2.5 text-slate-800">{item.description}</td><td className="py-2.5 text-slate-600">{(item.quantityMilli / 1000).toFixed(3).replace(/\.?0+$/, '')}</td><td className="py-2.5 text-slate-600">{rupees(item.unitPricePaise)}</td><td className="py-2.5 text-right font-semibold text-slate-800">{rupees(item.lineTotalPaise)}</td></tr>)}</tbody>
                      </table>
                    </div>
                    <div className="ml-auto max-w-xs space-y-1 text-right text-xs"><p className="flex justify-between"><span>Subtotal</span><strong>{rupees(invoice.subtotalPaise)}</strong></p><p className="flex justify-between"><span>Tax</span><strong>{rupees(invoice.taxPaise)}</strong></p><p className="flex justify-between border-t border-slate-200 pt-2 text-sm"><span>Total</span><strong>{rupees(invoice.totalPaise)}</strong></p></div>
                    {invoice.payments?.length > 0 && <div className="space-y-2"><h3 className="text-xs font-bold text-slate-800">Receipts</h3>{invoice.payments.map((payment) => <div key={payment._id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px]"><span><strong>{payment.receiptNumber}</strong> · {payment.method} · {dateTime(payment.paidAt)}{payment.transactionReference ? ` · ${payment.transactionReference}` : ''}</span><strong>{rupees(payment.amountPaise)}</strong></div>)}</div>}

                    {canRecord && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-900"><Wallet size={14} />Record received payment</h3>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[0.8fr_1fr_1.2fr_auto] lg:items-end">
                          <label className="text-[10px] font-semibold text-slate-600">Amount (INR)<input required type="number" min="0.01" max={balancePaise / 100} step="0.01" value={draft.amount ?? (balancePaise / 100).toFixed(2)} onChange={(event) => updatePaymentDraft(invoice._id, 'amount', event.target.value)} className={inputClass} /></label>
                          <label className="text-[10px] font-semibold text-slate-600">Method<select value={draft.method || 'BankTransfer'} onChange={(event) => updatePaymentDraft(invoice._id, 'method', event.target.value)} className={inputClass}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
                          <label className="text-[10px] font-semibold text-slate-600">Transaction reference{(draft.method || 'BankTransfer') !== 'Cash' && <span className="text-rose-600"> *</span>}<input required={(draft.method || 'BankTransfer') !== 'Cash'} maxLength={100} value={draft.transactionReference || ''} onChange={(event) => updatePaymentDraft(invoice._id, 'transactionReference', event.target.value)} className={inputClass} /></label>
                          <button type="button" disabled={busyId === invoice._id} onClick={() => recordPayment(invoice)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busyId === invoice._id ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}Save receipt</button>
                        </div>
                        <p className="mt-2 text-[9px] text-slate-500">Records funds already received by staff; this does not charge a card, verify a bank transfer, or contact a payment gateway.</p>
                      </div>
                    )}
                    {isStaff && invoice.invoiceStatus === 'Issued' && invoice.amountPaidPaise === 0 && <button type="button" disabled={busyId === invoice._id} onClick={() => cancelInvoice(invoice)} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Cancel unpaid invoice</button>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : <EmptyState isPayment={false} title="No invoices found" />}

      <footer className="flex items-center justify-between text-xs text-slate-500">
        <span>Page {pagination.page || pageNumber} of {Math.max(pagination.totalPages || 1, 1)}</span>
        <div className="flex gap-2">
          <button type="button" disabled={pageNumber <= 1 || loading} onClick={() => setPageNumber((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold disabled:opacity-40">Previous</button>
          <button type="button" disabled={pageNumber >= (pagination.totalPages || 1) || loading} onClick={() => setPageNumber((current) => current + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold disabled:opacity-40">Next</button>
        </div>
      </footer>

      {formOpen && <InvoiceForm shipments={shipments} onClose={() => setFormOpen(false)} onSubmit={createInvoice} saving={saving} />}
    </div>
  );
}

function EmptyState({ isPayment, title }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><FileText size={23} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-500">{isPayment ? 'Payment receipts will appear once staff record funds received against an invoice.' : 'Only delivered shipments with POD can be invoiced.'}</p></div>;
}

export default BillingManagement;
