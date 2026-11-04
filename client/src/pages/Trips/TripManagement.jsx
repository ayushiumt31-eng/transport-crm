import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarClock, Check, ClipboardList, LoaderCircle, Map, RefreshCw, Search, Truck, UserRound } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { apiFetch } from '../../auth/session';

const pageDetails = {
  '/trips/scheduling': {
    title: 'Trip scheduling',
    description: 'Schedule operational trips from confirmed bookings with active vehicle allocations.',
    endpoint: '/trips',
    icon: CalendarClock
  },
  '/trips/route-planning': {
    title: 'Trip route planning',
    description: 'Record route references, planned stops, and trip instructions before departure.',
    endpoint: '/trips/plans',
    icon: Map
  },
  '/trips/assignment': {
    title: 'Trip assignment',
    description: 'Assign an available, licence-qualified driver to a scheduled trip.',
    endpoint: '/trips/assignments',
    icon: UserRound
  },
  '/trips/monitoring': {
    title: 'Trip monitoring',
    description: 'Monitor active trips, record delays, resume progress, and confirm delivery.',
    endpoint: '/trips/active',
    icon: Truck
  },
  '/trips/history': {
    title: 'Trip history',
    description: 'Review completed and cancelled trips and their status history.',
    endpoint: '/trips/history',
    icon: ClipboardList
  }
};

async function tripRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

function tripLabel(trip) {
  const booking = trip.bookingId?.bookingNumber || 'Booking';
  const vehicle = trip.vehicleId?.registrationNumber || 'Vehicle';
  return `${trip.tripNumber} · ${booking} · ${vehicle}`;
}

function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function dateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function statusActions(trip, role) {
  const actions = [];
  if (trip.tripStatus === 'Assigned') actions.push({ status: 'InProgress', label: 'Start trip' });
  if (trip.tripStatus === 'InProgress') actions.push(
    { status: 'Delayed', label: 'Report delay' },
    { status: 'Completed', label: 'Complete trip' }
  );
  if (trip.tripStatus === 'Delayed') actions.push(
    { status: 'InProgress', label: 'Resume trip' },
    { status: 'Completed', label: 'Complete trip' }
  );
  if (role !== 'driver' && ['Scheduled', 'Assigned'].includes(trip.tripStatus)) {
    actions.push({ status: 'Cancelled', label: 'Cancel trip', danger: true });
  }
  return actions;
}

function TripTable({ rows, path, role, onAssign, onAction, onEditPlan, onDeletePlan }) {
  if (!rows.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No trip records to show yet.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[850px] text-left">
        <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Trip</th>
            <th className="px-4 py-3">Booking / vehicle</th>
            <th className="px-4 py-3">Driver / route</th>
            <th className="px-4 py-3">Schedule</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const trip = path === '/trips/route-planning' ? row.tripId : row;
            const actions = trip ? statusActions(trip, role) : [];
            return (
              <tr key={row._id} className="align-top hover:bg-slate-50/60">
                <td className="px-4 py-4">
                  <p className="text-xs font-bold text-slate-900">{trip?.tripNumber || 'Trip plan'}</p>
                  {path === '/trips/route-planning' && <p className="mt-1 text-[11px] text-slate-500">{row.routeId}</p>}
                </td>
                <td className="px-4 py-4 text-xs text-slate-700">
                  <p>{trip?.bookingId?.bookingNumber || '—'}</p>
                  <p className="mt-1 text-slate-500">{trip?.vehicleId?.registrationNumber || '—'}</p>
                  {(trip?.bookingId?.pickupAddress?.city || trip?.bookingId?.deliveryAddress?.city) && (
                    <p className="mt-1 text-[10px] text-slate-400">{trip.bookingId.pickupAddress?.city || '—'} → {trip.bookingId.deliveryAddress?.city || '—'}</p>
                  )}
                </td>
                <td className="px-4 py-4 text-xs text-slate-700">
                  <p>{trip?.driverId?.personalInfo?.fullName || trip?.driverId?.driverCode || 'Unassigned'}</p>
                  <p className="mt-1 text-slate-500">{trip?.routeId || (row.waypoints ? 'Route stops recorded' : 'Route not set')}</p>
                </td>
                <td className="px-4 py-4 text-xs text-slate-700">
                  <p>{dateTime(row.plannedStartDate || trip?.scheduledAt)}</p>
                  <p className="mt-1 text-slate-500">Due {dateTime(trip?.expectedDeliveryAt)}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                    {trip?.tripStatus || '—'}
                  </span>
                  {trip?.delayReason && <p className="mt-2 max-w-48 text-[10px] text-amber-700">{trip.delayReason}</p>}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {path === '/trips/assignment' && role !== 'driver' && trip?.tripStatus === 'Scheduled' && (
                      <button type="button" onClick={() => onAssign(trip)} className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-800">Assign driver</button>
                    )}
                    {actions.map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        onClick={() => onAction(trip, action)}
                        className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${action.danger ? 'border border-rose-200 text-rose-700 hover:bg-rose-50' : 'border border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                      >
                        {action.label}
                      </button>
                    ))}
                    {path === '/trips/route-planning' && role !== 'driver' && trip && ['Scheduled', 'Assigned'].includes(trip.tripStatus) && (
                      row._id
                        ? <>
                            <button type="button" onClick={() => onEditPlan(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100">Edit plan</button>
                            <button type="button" onClick={() => onDeletePlan(row)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50">Delete</button>
                          </>
                        : null
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function TripManagement({ path = window.location.pathname }) {
  const page = pageDetails[path];
  const Icon = page?.icon || Truck;
  const { role } = useAuth();
  const isDriver = role === 'driver';
  const isStaff = role === 'admin' || role === 'manager';
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [allocations, setAllocations] = useState([]);
  const [scheduledTrips, setScheduledTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedAllocation, setSelectedAllocation] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [assignmentTrip, setAssignmentTrip] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [routeId, setRouteId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [planRecord, setPlanRecord] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planValues, setPlanValues] = useState({ tripId: '', routeId: '', waypoints: '', plannedStartDate: '', notes: '' });

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft.trim());
      setPageNumber(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const loadRows = useCallback(async () => {
    if (!page) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(pageNumber), limit: '20' });
      if (search) params.set('search', search);
      const result = await tripRequest(`${page.endpoint}?${params.toString()}`);
      setRows(result.data || []);
      setPagination(result.pagination || { page: pageNumber, totalPages: 0, total: result.data?.length || 0 });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageNumber, search]);

  useEffect(() => { loadRows(); }, [loadRows]);

  useEffect(() => {
    if (!isStaff || !['/trips/scheduling', '/trips/route-planning'].includes(path)) return;
    let active = true;
    Promise.all([
      tripRequest('/trips?status=Scheduled&page=1&limit=100'),
      tripRequest('/trips?status=Assigned&page=1&limit=100')
    ]).then(([scheduled, assigned]) => {
      if (active) setScheduledTrips([...(scheduled.data || []), ...(assigned.data || [])]);
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    });
    return () => { active = false; };
  }, [isStaff, path]);

  useEffect(() => {
    if (!isStaff || path !== '/trips/scheduling') return;
    let active = true;
    tripRequest('/trips/options/allocations').then((result) => {
      if (active) setAllocations(result);
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    });
    return () => { active = false; };
  }, [isStaff, path]);

  async function createTrip(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await tripRequest('/trips', {
        method: 'POST',
        body: { allocationId: selectedAllocation, notes: scheduleNotes }
      });
      setNotice(`Trip ${result.tripNumber} scheduled.`);
      setSelectedAllocation('');
      setScheduleNotes('');
      await Promise.all([loadRows(), tripRequest('/trips/options/allocations').then(setAllocations)]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function openAssignment(trip) {
    setAssignmentTrip(trip);
    setSelectedDriver('');
    setRouteId(trip.routeId || '');
    setAssignmentNotes(trip.notes || '');
    setError('');
    try {
      const result = await tripRequest(`/trips/options/drivers?tripId=${encodeURIComponent(trip._id)}`);
      setDrivers(result);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function assignTrip(event) {
    event.preventDefault();
    if (!assignmentTrip) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await tripRequest(`/trips/${encodeURIComponent(assignmentTrip._id)}/assignment`, {
        method: 'PATCH',
        body: { driverId: selectedDriver, routeId, notes: assignmentNotes }
      });
      setNotice(`Driver assigned to ${assignmentTrip.tripNumber}.`);
      setAssignmentTrip(null);
      await loadRows();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function startTripAction(trip, action) {
    setPendingAction({ trip, action });
    setActionRemarks('');
  }

  async function confirmTripAction(event) {
    event.preventDefault();
    if (!pendingAction) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await tripRequest(`/trips/${encodeURIComponent(pendingAction.trip._id)}/status`, {
        method: 'PATCH',
        body: { tripStatus: pendingAction.action.status, remarks: actionRemarks }
      });
      setNotice(`${pendingAction.trip.tripNumber}: ${pendingAction.action.label.toLowerCase()} complete.`);
      setPendingAction(null);
      await loadRows();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadRoutePlans() {
    const result = await tripRequest('/trips/plans?page=1&limit=100');
    setRows(result.data || []);
  }

  function beginPlan(record = null) {
    setPlanRecord(record);
    setPlanOpen(true);
    setPlanValues(record ? {
      tripId: record.tripId?._id || '',
      routeId: record.routeId || '',
      waypoints: record.waypoints || '',
      plannedStartDate: dateInput(record.plannedStartDate),
      notes: record.notes || ''
    } : { tripId: '', routeId: '', waypoints: '', plannedStartDate: '', notes: '' });
  }

  async function savePlan(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        ...planValues,
        plannedStartDate: planValues.plannedStartDate
          ? new Date(`${planValues.plannedStartDate}T00:00:00.000Z`).toISOString()
          : null
      };
      await tripRequest(planRecord ? `/trips/plans/${encodeURIComponent(planRecord._id)}` : '/trips/plans', {
        method: planRecord ? 'PATCH' : 'POST',
        body: planRecord ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'tripId')) : payload
      });
      setNotice(planRecord ? 'Trip route plan updated.' : 'Trip route plan created.');
      setPlanRecord(null);
      setPlanOpen(false);
      await loadRoutePlans();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(plan) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await tripRequest(`/trips/plans/${encodeURIComponent(plan._id)}`, { method: 'DELETE' });
      setNotice('Trip route plan deleted.');
      await loadRoutePlans();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const tripOptions = useMemo(
    () => scheduledTrips.filter((trip) => ['Scheduled', 'Assigned'].includes(trip.tripStatus)),
    [scheduledTrips]
  );
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">Trip management</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950"><Icon size={22} className="text-emerald-700" />{page?.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{page?.description}</p>
        </div>
        <button type="button" onClick={loadRows} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={16} />{notice}</div>}

      {path === '/trips/scheduling' && isStaff && (
        <form onSubmit={createTrip} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-950"><CalendarClock size={18} className="text-emerald-700" />Schedule from active vehicle allocation</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Confirmed booking allocation
              <select required value={selectedAllocation} onChange={(event) => setSelectedAllocation(event.target.value)} className={inputClass}>
                <option value="">Select an active allocation</option>
                {allocations.map((allocation) => <option key={allocation._id} value={allocation._id}>{allocation.allocationNumber} · {allocation.bookingId?.bookingNumber} · {allocation.vehicleId?.registrationNumber} · {allocation.bookingId?.pickupAddress?.city} → {allocation.bookingId?.deliveryAddress?.city}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">Trip instructions
              <input maxLength={2000} value={scheduleNotes} onChange={(event) => setScheduleNotes(event.target.value)} className={inputClass} />
            </label>
          </div>
          <button type="submit" disabled={saving || !allocations.length} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
            {saving ? <LoaderCircle size={14} className="animate-spin" /> : <CalendarClock size={14} />}Schedule trip
          </button>
          {!allocations.length && <p className="mt-2 text-xs text-slate-500">Create a confirmed booking’s vehicle allocation first.</p>}
        </form>
      )}

      {path === '/trips/route-planning' && isStaff && (
        <div className="flex justify-end">
          <button type="button" onClick={() => beginPlan()} disabled={!tripOptions.length} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">Create route plan</button>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search trips, bookings, drivers…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-700" />
        </label>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="text-[11px] text-slate-500">{pagination.total ?? rows.length} trip record(s)</span>
          <button type="button" onClick={() => setPageNumber((current) => Math.max(1, current - 1))} disabled={loading || pageNumber <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600 disabled:opacity-40"><ArrowLeft size={12} />Previous</button>
          <span className="text-[10px] text-slate-500">Page {pagination.page || pageNumber}{pagination.totalPages ? ` / ${pagination.totalPages}` : ''}</span>
          <button type="button" onClick={() => setPageNumber((current) => current + 1)} disabled={loading || !pagination.totalPages || pageNumber >= pagination.totalPages} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600 disabled:opacity-40">Next<ArrowRight size={12} /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin text-emerald-700" />Loading trip records…</div>
      ) : (
        <TripTable rows={rows} path={path} role={role} onAssign={openAssignment} onAction={startTripAction} onEditPlan={beginPlan} onDeletePlan={deletePlan} />
      )}

      {assignmentTrip && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={assignTrip} className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Assign trip</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{tripLabel(assignmentTrip)}</h2>
              <p className="mt-1 text-xs text-slate-500">Only available drivers with a current HMV or Transport licence for this trip date are listed.</p>
            </div>
            <label className="block text-xs font-semibold text-slate-700">Eligible driver
              <select required value={selectedDriver} onChange={(event) => setSelectedDriver(event.target.value)} className={inputClass}>
                <option value="">Select an eligible driver</option>
                {drivers.map((driver) => <option key={driver._id} value={driver._id}>{driver.personalInfo?.fullName} · {driver.driverCode}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">Route reference
              <input maxLength={100} value={routeId} onChange={(event) => setRouteId(event.target.value)} className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-slate-700">Trip instructions
              <textarea rows={2} maxLength={2000} value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} className={inputClass} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAssignmentTrip(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
              <button type="submit" disabled={saving || !drivers.length} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Assigning…' : 'Assign driver'}</button>
            </div>
          </form>
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={confirmTripAction} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Confirm trip update</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{pendingAction.action.label} · {pendingAction.trip.tripNumber}</h2>
              <p className="mt-1 text-xs text-slate-500">This update changes trip status and may update the assigned vehicle and driver availability.</p>
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              {['Delayed', 'Cancelled'].includes(pendingAction.action.status) ? 'Reason (required)' : 'Remarks'}
              <textarea required={['Delayed', 'Cancelled'].includes(pendingAction.action.status)} maxLength={1000} rows={3} value={actionRemarks} onChange={(event) => setActionRemarks(event.target.value)} className={inputClass} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingAction(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Confirm update'}</button>
            </div>
          </form>
        </div>
      )}

      {planOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={savePlan} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Route planning</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{planRecord._id ? 'Update trip route plan' : 'Create trip route plan'}</h2>
            </div>
            {!planRecord._id && <label className="block text-xs font-semibold text-slate-700">Scheduled trip
              <select required value={planValues.tripId} onChange={(event) => setPlanValues((current) => ({ ...current, tripId: event.target.value }))} className={inputClass}>
                <option value="">Select a scheduled or assigned trip</option>
                {tripOptions.map((trip) => <option key={trip._id} value={trip._id}>{tripLabel(trip)}</option>)}
              </select>
            </label>}
            <label className="block text-xs font-semibold text-slate-700">Route reference
              <input required minLength={2} maxLength={100} value={planValues.routeId} onChange={(event) => setPlanValues((current) => ({ ...current, routeId: event.target.value }))} className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-slate-700">Planned start
              <input type="date" value={planValues.plannedStartDate} onChange={(event) => setPlanValues((current) => ({ ...current, plannedStartDate: event.target.value }))} className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-slate-700">Planned stops / waypoints
              <textarea rows={4} maxLength={5000} value={planValues.waypoints} onChange={(event) => setPlanValues((current) => ({ ...current, waypoints: event.target.value }))} className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-slate-700">Trip instructions
              <textarea rows={2} maxLength={2000} value={planValues.notes} onChange={(event) => setPlanValues((current) => ({ ...current, notes: event.target.value }))} className={inputClass} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setPlanOpen(false); setPlanRecord(null); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save route plan'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
