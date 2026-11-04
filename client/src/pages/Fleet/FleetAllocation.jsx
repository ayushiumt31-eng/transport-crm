import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, Check, LoaderCircle, RefreshCw, Truck } from 'lucide-react';
import { apiFetch } from '../../auth/session';

async function fleetRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

function dateValue(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function FleetAllocation() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [bookingId, setBookingId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAllocation, setBusyAllocation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedBooking = bookings.find((booking) => booking._id === bookingId);

  const loadAllocations = useCallback(async () => {
    const result = await fleetRequest('/fleet/vehicles/allocations?page=1&limit=100');
    setAllocations(result.data || []);
  }, []);

  const loadBookings = useCallback(async () => {
    const result = await fleetRequest('/fleet/vehicles/allocations/options/bookings');
    setBookings(result);
  }, []);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadAllocations(), loadBookings()]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    setVehicles([]);
    setVehicleId('');
    if (!selectedBooking) {
      setPickupDate('');
      setDeliveryDate('');
      return;
    }
    setPickupDate(dateValue(selectedBooking.schedule?.pickupDate));
    setDeliveryDate(dateValue(selectedBooking.schedule?.expectedDeliveryDate));
    let active = true;
    fleetRequest(`/fleet/vehicles/allocations/options/vehicles?bookingId=${encodeURIComponent(selectedBooking._id)}`)
      .then((result) => { if (active) setVehicles(result); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [selectedBooking]);

  async function createAllocation(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await fleetRequest('/fleet/vehicles/allocations', {
        method: 'POST',
        body: {
          bookingId,
          vehicleId,
          plannedPickupDate: new Date(`${pickupDate}T00:00:00.000Z`).toISOString(),
          plannedDeliveryDate: new Date(`${deliveryDate}T23:59:59.999Z`).toISOString(),
          remarks
        }
      });
      setNotice('Vehicle allocated to the confirmed booking.');
      setBookingId('');
      setVehicleId('');
      setRemarks('');
      await loadAll();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateAllocation(allocation, status) {
    setBusyAllocation(allocation._id);
    setError('');
    setNotice('');
    try {
      await fleetRequest(`/fleet/vehicles/allocations/${encodeURIComponent(allocation._id)}/status`, {
        method: 'PATCH',
        body: {
          allocationStatus: status,
          remarks: status === 'Released' ? 'Vehicle released back to fleet.' : 'Allocation cancelled.'
        }
      });
      setNotice(`Allocation ${allocation.allocationNumber} ${status.toLowerCase()}.`);
      await loadAll();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAllocation('');
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">Fleet management</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Vehicle allocation</h1>
          <p className="mt-1 text-sm text-slate-600">Allocate eligible available vehicles to confirmed bookings.</p>
        </div>
        <button type="button" onClick={loadAll} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={16} />{notice}</div>}

      <form onSubmit={createAllocation} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-950"><Truck size={18} className="text-emerald-700" />New allocation</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">Confirmed booking
            <select required value={bookingId} onChange={(event) => setBookingId(event.target.value)} className={inputClass}>
              <option value="">Select a confirmed booking</option>
              {bookings.map((booking) => <option key={booking._id} value={booking._id}>{booking.bookingNumber} · {booking.pickupAddress?.city} → {booking.deliveryAddress?.city} · {booking.cargo?.weightKg} kg</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">Eligible available vehicle
            <select required disabled={!bookingId || vehicles.length === 0} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className={inputClass}>
              <option value="">{bookingId ? vehicles.length ? 'Select an eligible vehicle' : 'No eligible vehicles available' : 'Select a booking first'}</option>
              {vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.registrationNumber} · {vehicle.vehicleType} · {vehicle.capacity?.value} {vehicle.capacity?.unit}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">Planned pickup
            <input required type="date" min={dateValue(selectedBooking?.schedule?.pickupDate)} max={dateValue(selectedBooking?.schedule?.expectedDeliveryDate)} value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} className={inputClass} />
          </label>
          <label className="text-xs font-semibold text-slate-700">Planned delivery
            <input required type="date" min={pickupDate || dateValue(selectedBooking?.schedule?.pickupDate)} max={dateValue(selectedBooking?.schedule?.expectedDeliveryDate)} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className={inputClass} />
          </label>
          <label className="text-xs font-semibold text-slate-700 md:col-span-2">Allocation remarks
            <input maxLength={500} value={remarks} onChange={(event) => setRemarks(event.target.value)} className={inputClass} />
          </label>
        </div>
        <button type="submit" disabled={saving || loading || !bookingId || !vehicleId} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
          {saving ? <LoaderCircle size={15} className="animate-spin" /> : <CalendarClock size={15} />}
          {saving ? 'Allocating…' : 'Allocate vehicle'}
        </button>
      </form>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-950">Allocation records</h2>
          <p className="mt-1 text-xs text-slate-500">Active reservations and released allocation history.</p>
        </div>
        <table className="w-full min-w-[800px] text-left">
          <thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <th className="px-5 py-3">Allocation</th><th className="px-4 py-3">Booking</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Schedule</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan="6" className="px-5 py-10 text-center text-sm text-slate-500"><LoaderCircle size={16} className="mx-auto mb-2 animate-spin" />Loading allocations…</td></tr>
              : allocations.length === 0 ? <tr><td colSpan="6" className="px-5 py-10 text-center text-sm text-slate-500">No allocations have been recorded.</td></tr>
                : allocations.map((allocation) => <tr key={allocation._id} className="text-xs text-slate-700">
                  <td className="px-5 py-3 font-semibold">{allocation.allocationNumber}</td>
                  <td className="px-4 py-3">{allocation.bookingId?.bookingNumber || 'Booking unavailable'}<div className="mt-1 text-[10px] text-slate-500">{allocation.bookingId?.pickupAddress?.city} → {allocation.bookingId?.deliveryAddress?.city}</div></td>
                  <td className="px-4 py-3">{allocation.vehicleId?.registrationNumber || 'Vehicle unavailable'}<div className="mt-1 text-[10px] text-slate-500">{allocation.vehicleId?.vehicleType}</div></td>
                  <td className="px-4 py-3">{dateValue(allocation.plannedPickupDate)} – {dateValue(allocation.plannedDeliveryDate)}</td>
                  <td className="px-4 py-3 font-semibold">{allocation.allocationStatus}</td>
                  <td className="px-4 py-3 text-right">{allocation.allocationStatus === 'Allocated' && <div className="inline-flex gap-2">
                    <button type="button" disabled={busyAllocation === allocation._id} onClick={() => updateAllocation(allocation, 'Released')} className="rounded-md border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">{busyAllocation === allocation._id ? 'Saving…' : 'Release'}</button>
                    <button type="button" disabled={busyAllocation === allocation._id} onClick={() => updateAllocation(allocation, 'Cancelled')} className="rounded-md border border-rose-200 px-2.5 py-1.5 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Cancel</button>
                  </div>}</td>
                </tr>)}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default FleetAllocation;
