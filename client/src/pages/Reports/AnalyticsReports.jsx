import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, Calendar, Download, LoaderCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../auth/session';

const reportPages = {
  '/reports/fleet': {
    title: 'Fleet reports',
    description: 'Current fleet availability, operating status and vehicle type breakdown.',
    endpoint: '/fleet/vehicles/dashboard',
    dateFilter: false,
    rows: (data) => (data.vehicleTypeBreakdown || []).map((item) => ({ vehicleType: item._id || 'Other', vehicleCount: item.count })),
    metrics: (data) => [
      ['Total vehicles', data.summary?.total],
      ['Available', data.summary?.available],
      ['On trip', data.summary?.onTrip],
      ['Under maintenance', data.summary?.underMaintenance],
      ['Active allocations', data.summary?.activeAllocations]
    ],
    note: 'Fleet status is a current snapshot; it is not a historical status report.'
  },
  '/reports/driver': {
    title: 'Driver reports',
    description: 'Attendance totals and trip outcomes for the selected period.',
    endpoint: '/drivers/performance',
    dateFilter: true,
    rows: (data) => [{ ...(data.summary || {}), scope: data.scope }],
    metrics: (data) => [
      ['Drivers', data.summary?.totalDrivers],
      ['Attendance rate', `${data.summary?.attendanceRate ?? 0}%`],
      ['Present days', data.summary?.presentDays],
      ['Absent days', data.summary?.absentDays],
      ['Completed trips', data.summary?.completedTrips],
      ['Delayed trips', data.summary?.delayedTrips]
    ],
    note: 'Driver performance currently uses attendance and trip status totals; GPS-based distance and route efficiency are not included.'
  },
  '/reports/fuel': {
    title: 'Fuel reports',
    description: 'Recorded fuel cost, volume and mileage by vehicle.',
    endpoint: '/fuel/reports/summary',
    dateFilter: true,
    rows: (data) => (data.byVehicle || []).map((item) => ({
      vehicle: item.vehicle?.registrationNumber || 'Vehicle unavailable',
      fuelType: item.vehicle?.fuelType || '—',
      entries: item.entryCount,
      quantity: `${item.quantity} ${item.unit}`,
      totalCost: formatCurrency(item.totalCostPaise)
    })),
    metrics: (data) => [
      ['Fuel entries', data.entryCount],
      ['Total fuel cost', formatCurrency(data.totalCostPaise)],
      ...((data.quantityByUnit || []).map((item) => [`Quantity (${item.unit})`, formatNumber(item.quantity)]))
    ],
    note: 'Fuel cost and mileage are based on recorded fuel entries. Missing receipts or unrecorded refuelling are not estimated.'
  },
  '/reports/maintenance': {
    title: 'Maintenance reports',
    description: 'Service and repair work orders with completed costs.',
    endpoint: '/maintenance/reports/summary',
    dateFilter: false,
    rows: (data) => [
      ...(data.counts || []).map((item) => ({ recordType: item.recordType, status: item.status, count: item.count, completedCost: '—' })),
      ...(data.completed || []).map((item) => ({ recordType: item.recordType, status: 'Completed', count: item.completedCount, completedCost: formatCurrency(item.actualCostPaise) }))
    ],
    metrics: (data) => [
      ['Work orders', (data.counts || []).reduce((total, item) => total + item.count, 0)],
      ['Completed records', (data.completed || []).reduce((total, item) => total + item.completedCount, 0)],
      ['Recorded completed cost', formatCurrency((data.completed || []).reduce((total, item) => total + item.actualCostPaise, 0))]
    ],
    note: 'This report is all-time because the maintenance summary API does not yet support date filtering.'
  },
  '/reports/revenue': {
    title: 'Revenue reports',
    description: 'Invoices issued, amounts billed and payments collected for the selected period.',
    endpoint: '/billing/reports/summary',
    dateFilter: true,
    rows: (data) => [{ invoices: data.invoiceCount, billed: formatCurrency(data.billedPaise), collected: formatCurrency(data.collectedPaise), outstanding: formatCurrency(data.outstandingPaise), overdueInvoices: data.overdueInvoices }],
    metrics: (data) => [
      ['Invoices', data.invoiceCount],
      ['Billed', formatCurrency(data.billedPaise)],
      ['Collected', formatCurrency(data.collectedPaise)],
      ['Outstanding', formatCurrency(data.outstandingPaise)],
      ['Overdue invoices', data.overdueInvoices]
    ],
    note: 'Amounts come from internal invoices and recorded payments. Gateway collection and statutory GST/e-invoicing are not connected.'
  },
  '/reports/expense': {
    title: 'Expense reports',
    description: 'Recorded operating expenses by category and vehicle for the selected period.',
    endpoint: '/billing/expenses/reports/summary',
    dateFilter: true,
    rows: (data) => (data.byCategory || []).map((item) => ({
      category: item.category,
      entries: item.entryCount,
      totalCost: formatCurrency(item.totalCostPaise)
    })),
    metrics: (data) => [
      ['Expense entries', data.entryCount],
      ['Recorded total', formatCurrency(data.totalCostPaise)],
      ['Categories', data.byCategory?.length ?? 0]
    ],
    note: 'This report includes only manually recorded expense-ledger entries. Fuel and Maintenance ledgers are separate; avoid recording the same transaction in both.'
  },
  '/reports/trip': {
    title: 'Trip reports',
    description: 'Scheduled, active, delayed, completed and cancelled trips for the selected period.',
    endpoint: '/trips/metrics',
    dateFilter: true,
    rows: (data) => [data],
    metrics: (data) => [
      ['Total trips', data.total],
      ['Scheduled', data.scheduled],
      ['Assigned', data.assigned],
      ['In progress', data.inProgress],
      ['Delayed', data.delayed],
      ['Completed', data.completed],
      ['Cancelled', data.cancelled]
    ],
    note: 'Trip counts use scheduled pickup date for period filtering.'
  },
  '/reports/utilization': {
    title: 'Vehicle utilization',
    description: 'Measure actual vehicle trip hours from recorded departure and completion events.',
    endpoint: '/fleet/vehicles/utilization',
    dateFilter: true,
    rows: (data) => (data.vehicles || []).map((item) => ({
      registrationNumber: item.registrationNumber,
      vehicleType: item.vehicleType,
      currentStatus: item.isDeleted ? 'Deleted' : item.vehicleStatus,
      trips: item.tripCount,
      actualTripHours: formatNumber(item.trackedTripHours)
    })),
    metrics: (data) => [
      ['Tracked trip hours', formatNumber(data.trackedTripHours)],
      ['Trips overlapping period', data.tripCount],
      ['Vehicles used', data.vehiclesWithTripActivity],
      ['Vehicles in report', data.vehicles?.length ?? 0]
    ],
    note: 'Hours are calculated from actual trip start/completion timestamps, clipped to the selected date range. In-progress trips are counted through now. This is measured trip usage, not a utilization percentage: vehicle availability/ownership history and shift hours are not tracked.'
  }
};

function formatCurrency(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise || 0) / 100);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function dateInputValue(date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function cellValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function csvCell(value) {
  let text = cellValue(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function AnalyticsReports({ path = window.location.pathname }) {
  const report = reportPages[path];
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { startDate: dateInputValue(start), endDate: dateInputValue(today) };
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (report?.dateFilter && period.startDate) params.set('startDate', period.startDate);
    if (report?.dateFilter && period.endDate) params.set('endDate', period.endDate);
    return params.toString();
  }, [report, period]);

  const loadReport = useCallback(async () => {
    if (!report?.endpoint) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${report.endpoint}${query ? `?${query}` : ''}`);
      setData(response.data ?? response);
    } catch (requestError) {
      setData(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [query, report]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const metrics = report?.metrics?.(data || {}) || [];
  const rows = report?.rows?.(data || {}) || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];

  function exportCsv() {
    setExportError('');
    if (!rows.length || !columns.length) {
      setExportError('There are no report rows to export for this selection.');
      return;
    }
    const content = [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${path.split('/').pop()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (!report) return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Report configuration is missing.</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">Reports & analytics</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950"><BarChart3 size={22} className="text-emerald-700" />{report.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{report.description}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {report.dateFilter && <>
            <label className="text-xs font-semibold text-slate-600">From<input type="date" value={period.startDate} max={period.endDate} onChange={(event) => setPeriod((current) => ({ ...current, startDate: event.target.value }))} className="mt-1 block rounded-lg border border-slate-300 px-2.5 py-2 text-xs" /></label>
            <label className="text-xs font-semibold text-slate-600">To<input type="date" value={period.endDate} min={period.startDate} onChange={(event) => setPeriod((current) => ({ ...current, endDate: event.target.value }))} className="mt-1 block rounded-lg border border-slate-300 px-2.5 py-2 text-xs" /></label>
          </>}
          {report.endpoint && <>
            <button type="button" onClick={loadReport} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
            <button type="button" onClick={exportCsv} disabled={loading || rows.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><Download size={14} />Export CSV</button>
          </>}
        </div>
      </header>

      {report.unavailable && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><h2 className="font-bold">Report not available yet</h2><p className="mt-1 text-xs leading-5 text-amber-900">{report.unavailable}</p></section>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      {exportError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertCircle size={15} className="mt-0.5 shrink-0" />{exportError}</div>}
      {report.endpoint && <>
        {loading && !data ? <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-12 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" />Loading report…</div> : <>
          {!!metrics.length && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {metrics.map(([label, value]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-950">{value === undefined ? '—' : value}</p></article>)}
          </section>}
          {report.note && <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600"><Calendar size={14} className="mt-0.5 shrink-0" />{report.note}</p>}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-bold text-slate-900">Report details</h2></div>
            {loading ? <div className="p-8 text-center text-xs text-slate-500">Refreshing report…</div> : rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No records for this report and period.</div> : <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-bold">{column.replaceAll(/([A-Z])/g, ' $1')}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index} className="text-slate-700">{columns.map((column) => <td key={column} className="px-4 py-3">{cellValue(row[column])}</td>)}</tr>)}</tbody>
              </table>
            </div>}
          </section>
        </>}
      </>}
    </div>
  );
}
