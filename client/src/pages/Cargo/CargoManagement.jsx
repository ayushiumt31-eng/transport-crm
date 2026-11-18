import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDownToLine, Check, ClipboardList, LoaderCircle, MapPin, Package, Plus, RefreshCw, Search, Truck } from 'lucide-react';
import { apiFetch } from '../../auth/session';
import { useAuth } from '../../auth/AuthContext';

const pageDetails = {
  '/cargo/booking': {
    title: 'Shipment booking',
    description: 'Create a shipment from a confirmed customer booking and issue its consignment number.',
    canCreate: true
  },
  '/cargo/tracking': {
    title: 'Parcel tracking',
    description: 'Follow shipment milestones, trip assignment, and the audited tracking history.'
  },
  '/cargo/status': {
    title: 'Delivery status',
    description: 'Advance shipment milestones in order and record delivery exceptions.'
  },
  '/cargo/consignment': {
    title: 'Consignments / LR',
    description: 'Review consignment references, booking details, assigned trips, and delivery status.'
  },
  '/cargo/pod': {
    title: 'Proof of delivery',
    description: 'Upload or securely download proof-of-delivery documents for authorized shipments.'
  }
};

const transitions = {
  Booked: ['ReadyForPickup', 'Exception', 'Cancelled'],
  ReadyForPickup: ['PickedUp', 'Exception', 'Cancelled'],
  PickedUp: ['InTransit', 'Exception'],
  InTransit: ['OutForDelivery', 'Exception'],
  OutForDelivery: ['Delivered', 'Exception'],
  Exception: [],
  Delivered: [],
  Cancelled: []
};

const statusLabels = {
  Booked: 'Booked',
  ReadyForPickup: 'Ready for pickup',
  PickedUp: 'Picked up',
  InTransit: 'In transit',
  OutForDelivery: 'Out for delivery',
  Delivered: 'Delivered',
  Exception: 'Exception',
  Cancelled: 'Cancelled'
};

async function cargoRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

let mapsLoadPromise;

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => window.google?.maps
      ? resolve(window.google.maps)
      : reject(new Error('Google Maps loaded without its JavaScript API.'));
    script.onerror = () => {
      mapsLoadPromise = null;
      reject(new Error('Google Maps could not load. Check the Maps JavaScript API, billing, and key restrictions.'));
    };
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

function CustomerTrackingMap({ apiKey, tracking, onError }) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const [mapsReady, setMapsReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadGoogleMaps(apiKey).then((maps) => {
      if (!active || !elementRef.current) return;
      mapRef.current = new maps.Map(elementRef.current, {
        center: { lat: 22.9734, lng: 78.6569 },
        zoom: 5,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
      });
      setMapsReady(true);
    }).catch((error) => onError(error.message));
    return () => { active = false; };
  }, [apiKey, onError]);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map || !tracking?.location) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const trail = tracking.trail || [];
    const path = trail.map((point) => ({ lat: point.latitude, lng: point.longitude }));
    const current = { lat: tracking.location.latitude, lng: tracking.location.longitude };
    const marker = new maps.Marker({
      map,
      position: current,
      title: `${tracking.vehicle?.registrationNumber || 'Vehicle'} · last update ${new Date(tracking.location.recordedAt).toLocaleString()}`
    });
    overlaysRef.current.push(marker);
    if (path.length > 1) {
      const line = new maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor: '#047857',
        strokeOpacity: 0.9,
        strokeWeight: 4
      });
      overlaysRef.current.push(line);
    }

    const bounds = new maps.LatLngBounds();
    [...path, current].forEach((point) => bounds.extend(point));
    if (path.length > 1) map.fitBounds(bounds, 48);
    else {
      map.panTo(current);
      map.setZoom(13);
    }
    return () => {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
    };
  }, [mapsReady, tracking]);

  return <div ref={elementRef} className="h-[360px] w-full rounded-xl bg-slate-100" aria-label="Map showing the current shipment vehicle location" />;
}

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function localDateTimeValue(value = new Date()) {
  const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function addressLine(address) {
  if (!address) return '—';
  return [address.city, address.state].filter(Boolean).join(', ') || address.street || '—';
}

function allowedStatuses(shipment, role) {
  const current = shipment.shipmentStatus;
  let next = current === 'Exception'
    ? (role === 'admin' || role === 'manager') && shipment.previousStatus ? [shipment.previousStatus] : []
    : transitions[current] || [];

  if (role === 'driver') {
    next = next.filter((status) => !['Exception', 'Cancelled', 'ReadyForPickup'].includes(status));
  }
  if (shipment.trip?.tripStatus !== 'InProgress') {
    next = next.filter((status) => status !== 'PickedUp');
  }
  if (!['InProgress', 'Delayed'].includes(shipment.trip?.tripStatus)) {
    next = next.filter((status) => !['InTransit', 'OutForDelivery'].includes(status));
  }
  if (shipment.trip?.tripStatus !== 'Completed' || !shipment.pod) {
    next = next.filter((status) => status !== 'Delivered');
  }
  return next;
}

function CargoManagement({ path }) {
  const { role } = useAuth();
  const page = pageDetails[path] || pageDetails['/cargo/tracking'];
  const isStaff = role === 'admin' || role === 'manager';
  const isCustomer = role === 'customer';
  const canUpdate = isStaff || role === 'driver';
  const [rows, setRows] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingId, setBookingId] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });
  const [selectedStatuses, setSelectedStatuses] = useState({});
  const [remarks, setRemarks] = useState({});
  const [receivers, setReceivers] = useState({});
  const [receivedTimes, setReceivedTimes] = useState({});
  const [podRemarks, setPodRemarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [trackingShipmentId, setTrackingShipmentId] = useState('');
  const [liveTracking, setLiveTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [mapKey, setMapKey] = useState('');
  const [mapError, setMapError] = useState('');

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(pageNumber), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const result = await cargoRequest(`/cargo/shipments?${params}`);
      setRows(result.data || []);
      setPagination(result.pagination || { total: result.data?.length || 0, page: pageNumber, totalPages: 0 });
    } catch (requestError) {
      setRows([]);
      setPagination({ total: 0, page: pageNumber, totalPages: 0 });
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [pageNumber, search, statusFilter]);

  const loadConfirmedBookings = useCallback(async () => {
    if (!isStaff || !page.canCreate) return;
    try {
      const result = await cargoRequest('/cargo/shipments/options/bookings?page=1&limit=100');
      setBookings(result.data || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [isStaff, page.canCreate]);

  useEffect(() => { loadShipments(); }, [loadShipments]);
  useEffect(() => { loadConfirmedBookings(); }, [loadConfirmedBookings]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft.trim());
      setPageNumber(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const loadLiveTracking = useCallback(async (shipmentId, { showLoading = false } = {}) => {
    if (showLoading) setTrackingLoading(true);
    setTrackingError('');
    try {
      const tracking = await cargoRequest(`/cargo/shipments/${encodeURIComponent(shipmentId)}/live-location`);
      setLiveTracking(tracking);
      if (!mapKey) {
        try {
          const config = await cargoRequest('/gps/map-config');
          setMapKey(config.apiKey);
          setMapError('');
        } catch (requestError) {
          setMapError(requestError.message);
        }
      }
    } catch (requestError) {
      setTrackingError(requestError.message);
    } finally {
      if (showLoading) setTrackingLoading(false);
    }
  }, [mapKey]);

  useEffect(() => {
    if (!isCustomer || path !== '/cargo/tracking' || !trackingShipmentId) return undefined;
    const timer = window.setInterval(() => {
      loadLiveTracking(trackingShipmentId);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isCustomer, path, trackingShipmentId, loadLiveTracking]);

  async function createShipment(event) {
    event.preventDefault();
    if (!bookingId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await cargoRequest('/cargo/shipments', {
        method: 'POST',
        body: { bookingId }
      });
      setNotice(`Consignment ${result.consignmentNumber} created.`);
      setBookingId('');
      await loadShipments();
      await loadConfirmedBookings();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(shipment) {
    const shipmentStatus = selectedStatuses[shipment._id];
    if (!shipmentStatus) return;
    const reason = remarks[shipment._id] || '';
    setBusyId(shipment._id);
    setError('');
    setNotice('');
    try {
      await cargoRequest(`/cargo/shipments/${encodeURIComponent(shipment._id)}/status`, {
        method: 'PATCH',
        body: { shipmentStatus, remarks: reason }
      });
      setNotice(`Shipment ${shipment.consignmentNumber} updated to ${statusLabels[shipmentStatus]}.`);
      setSelectedStatuses((current) => ({ ...current, [shipment._id]: '' }));
      setRemarks((current) => ({ ...current, [shipment._id]: '' }));
      await loadShipments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  async function uploadPod(event, shipment) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.namedItem('file')?.files?.[0];
    const receivedBy = receivers[shipment._id]?.trim();
    const receivedAt = receivedTimes[shipment._id];
    if (!receivedBy || !receivedAt || Number.isNaN(new Date(receivedAt).getTime())) {
      setError('Enter the receiver name and confirm the delivery date and time.');
      return;
    }
    const payload = new FormData();
    payload.set('receivedBy', receivedBy);
    payload.set('receivedAt', new Date(receivedAt).toISOString());
    payload.set('remarks', podRemarks[shipment._id] || '');
    if (file) payload.set('file', file);
    setBusyId(shipment._id);
    setError('');
    setNotice('');
    try {
      await cargoRequest(`/cargo/shipments/${encodeURIComponent(shipment._id)}/pod`, {
        method: 'POST',
        body: payload
      });
      setNotice(`Delivery record saved for ${shipment.consignmentNumber}.`);
      setReceivers((current) => ({ ...current, [shipment._id]: '' }));
      setReceivedTimes((current) => ({ ...current, [shipment._id]: '' }));
      setPodRemarks((current) => ({ ...current, [shipment._id]: '' }));
      form.reset();
      await loadShipments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  async function downloadPod(shipment) {
    setBusyId(shipment._id);
    setError('');
    try {
      const response = await apiFetch(`/cargo/shipments/${encodeURIComponent(shipment._id)}/pod/download`, { raw: true });
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = shipment.pod.originalName || `${shipment.consignmentNumber}-pod`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Package size={22} /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Cargo & shipment</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{page.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{page.description}</p>
          </div>
        </div>
        <button type="button" onClick={loadShipments} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><Check size={15} />{notice}</div>}

      {isStaff && page.canCreate && (
        <form onSubmit={createShipment} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900"><Plus size={16} className="text-emerald-700" />Create shipment from confirmed booking</h2>
          <p className="mb-4 text-xs text-slate-500">The API validates that the booking is confirmed and creates one consignment per booking.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select required value={bookingId} onChange={(event) => setBookingId(event.target.value)} className={inputClass}>
              <option value="">Select a confirmed booking</option>
              {bookings.map((booking) => (
                <option key={booking._id} value={booking._id}>
                  {booking.bookingNumber} · {booking.cargo?.goodsType || 'Cargo'} · {addressLine(booking.pickupAddress)} → {addressLine(booking.deliveryAddress)}
                </option>
              ))}
            </select>
            <button type="submit" disabled={saving || !bookingId} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}Create consignment
            </button>
          </div>
          {!bookings.length && <p className="mt-2 text-[11px] text-slate-500">No unshipped confirmed bookings are currently available.</p>}
        </form>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="relative min-w-0 flex-1 text-[10px] font-semibold text-slate-500">
          <span className="mb-1 block">Search consignment, booking, goods or city</span>
          <Search size={14} className="absolute bottom-3 left-3 text-slate-400" />
          <input value={searchDraft} onChange={(event) => { setSearchDraft(event.target.value); setPageNumber(1); }} className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-emerald-600" placeholder="Search shipments…" />
        </label>
        <label className="text-[10px] font-semibold text-slate-500">
          <span className="mb-1 block">Shipment status</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPageNumber(1); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs sm:w-48">
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <p className="text-xs text-slate-500">{pagination.total} total records</p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500"><LoaderCircle size={18} className="mx-auto mb-2 animate-spin text-emerald-700" />Loading live shipment records…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <ClipboardList size={23} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-800">No shipments found</p>
          <p className="mt-1 text-xs text-slate-500">Shipments become available after staff confirm a booking and create its consignment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((shipment) => {
            const booking = shipment.bookingId || {};
            const statuses = canUpdate ? allowedStatuses(shipment, role) : [];
            return (
              <article key={shipment._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Consignment</p>
                    <h2 className="mt-1 text-base font-bold text-slate-950">{shipment.consignmentNumber}</h2>
                    <p className="mt-1 text-xs text-slate-600">Booking {booking.bookingNumber || '—'} · {booking.cargo?.goodsType || 'Cargo'}</p>
                  </div>
                  <span className="w-fit rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800">{statusLabels[shipment.shipmentStatus] || shipment.shipmentStatus}</span>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Route</p>
                    <p className="mt-1 text-xs font-semibold text-slate-800">{addressLine(booking.pickupAddress)} → {addressLine(booking.deliveryAddress)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cargo / schedule</p>
                    <p className="mt-1 text-xs font-semibold text-slate-800">{booking.cargo?.quantity || '—'} × {booking.cargo?.packageType || 'packages'} · {booking.cargo?.weightKg || '—'} kg</p>
                    <p className="mt-1 text-[10px] text-slate-500">Pickup {dateTime(booking.schedule?.pickupDate)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Assigned trip</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-800"><Truck size={13} />{shipment.trip?.tripNumber || 'Not scheduled'}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{shipment.trip?.vehicleId?.registrationNumber || 'No vehicle'} · {shipment.trip?.driverId?.personalInfo?.fullName || 'No driver'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Proof of delivery</p>
                    {shipment.pod ? (
                      <div className="mt-1">
                        <p className="text-xs font-semibold text-slate-800">{shipment.pod.receivedBy} · {dateTime(shipment.pod.receivedAt)}</p>
                        {shipment.pod.originalName ? (
                          <button type="button" disabled={busyId === shipment._id} onClick={() => downloadPod(shipment)} className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ArrowDownToLine size={12} />Download POD</button>
                        ) : <p className="mt-1 text-[10px] text-slate-500">Delivery record saved without an attachment.</p>}
                      </div>
                    ) : <p className="mt-1 text-xs text-slate-500">Not uploaded</p>}
                  </div>
                </div>

                {isCustomer && path === '/cargo/tracking' && (
                  <div className="border-t border-slate-100 p-4 sm:p-5">
                    <button
                      type="button"
                      onClick={() => {
                        if (trackingShipmentId === shipment._id) {
                          setTrackingShipmentId('');
                          setLiveTracking(null);
                          setTrackingError('');
                          return;
                        }
                        setTrackingShipmentId(shipment._id);
                        setLiveTracking(null);
                        setTrackingError('');
                        loadLiveTracking(shipment._id, { showLoading: true });
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                    >
                      <MapPin size={14} />{trackingShipmentId === shipment._id ? 'Hide live location' : 'View live vehicle location'}
                    </button>
                    {trackingShipmentId === shipment._id && (
                      <div className="mt-4 space-y-3">
                        {trackingError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{trackingError}</p>}
                        {trackingLoading && <p className="text-xs text-slate-500">Loading latest vehicle location…</p>}
                        {!trackingLoading && liveTracking && !liveTracking.available && (
                          <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                            Live location is available after the assigned trip starts and the driver shares phone GPS.
                          </p>
                        )}
                        {!trackingLoading && liveTracking?.available && !liveTracking.location && (
                          <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                            Trip is active, but the driver has not shared a location yet.
                          </p>
                        )}
                        {liveTracking?.location && (
                          <div className="space-y-2">
                            <p role="status" className={`rounded-lg p-3 text-xs ${liveTracking.location.isStale ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'border border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
                              {liveTracking.location.isStale ? 'Last location may be out of date' : 'Live location'} · {liveTracking.vehicle?.registrationNumber || 'Vehicle'} · Updated {dateTime(liveTracking.location.recordedAt)}
                            </p>
                            <p className="text-[10px] text-slate-500">Map refreshes every 15 seconds while this panel is open. The driver’s phone must have location sharing enabled and internet access.</p>
                            {mapKey && <CustomerTrackingMap apiKey={mapKey} tracking={liveTracking} onError={setMapError} />}
                            {mapError && <p role="alert" className="text-xs text-rose-700">{mapError}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {canUpdate && statuses.length > 0 && (
                  <div className="grid gap-2 border-t border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-[minmax(10rem,0.5fr)_minmax(12rem,1fr)_auto] sm:items-end">
                    <label className="text-[10px] font-semibold text-slate-600">
                      Update milestone
                      <select value={selectedStatuses[shipment._id] || ''} onChange={(event) => setSelectedStatuses((current) => ({ ...current, [shipment._id]: event.target.value }))} className={inputClass}>
                        <option value="">Choose next status</option>
                        {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                      </select>
                    </label>
                    <label className="text-[10px] font-semibold text-slate-600">
                      Remarks {['Exception', 'Cancelled'].includes(selectedStatuses[shipment._id]) && <span className="text-rose-600">(required)</span>}
                      <input value={remarks[shipment._id] || ''} onChange={(event) => setRemarks((current) => ({ ...current, [shipment._id]: event.target.value }))} className={inputClass} placeholder="Optional update or required reason" />
                    </label>
                    <button type="button" disabled={!selectedStatuses[shipment._id] || busyId === shipment._id} onClick={() => updateStatus(shipment)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
                      {busyId === shipment._id ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Update status
                    </button>
                  </div>
                )}

                {!shipment.pod && canUpdate && ['PickedUp', 'InTransit', 'OutForDelivery'].includes(shipment.shipmentStatus) && (
                  <form onSubmit={(event) => uploadPod(event, shipment)} className="grid gap-2 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_1.4fr_auto] lg:items-end">
                    <label className="text-[10px] font-semibold text-slate-600">
                      Received by
                      <input required minLength={2} maxLength={100} value={receivers[shipment._id] || ''} onChange={(event) => setReceivers((current) => ({ ...current, [shipment._id]: event.target.value }))} className={inputClass} />
                    </label>
                    <label className="text-[10px] font-semibold text-slate-600">
                      Delivery date and time
                      <input required type="datetime-local" value={receivedTimes[shipment._id] ?? localDateTimeValue()} onChange={(event) => setReceivedTimes((current) => ({ ...current, [shipment._id]: event.target.value }))} className={inputClass} />
                    </label>
                    <label className="text-[10px] font-semibold text-slate-600">
                      POD file (optional; PDF, JPEG or PNG, max 5 MB)
                      <input type="file" name="file" accept="application/pdf,image/jpeg,image/png" className={`${inputClass} file:mr-2 file:rounded-md file:border-0 file:bg-emerald-50 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-emerald-800`} />
                    </label>
                    <label className="text-[10px] font-semibold text-slate-600">
                      Delivery remarks
                      <input value={podRemarks[shipment._id] || ''} onChange={(event) => setPodRemarks((current) => ({ ...current, [shipment._id]: event.target.value }))} className={inputClass} />
                    </label>
                    <button type="submit" disabled={busyId === shipment._id} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-700 px-3 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
                      {busyId === shipment._id ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}Save delivery record
                    </button>
                  </form>
                )}

                <details className="border-t border-slate-100">
                  <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">Status history ({shipment.statusHistory?.length || 0})</summary>
                  <ol className="space-y-3 px-5 pb-4">
                    {(shipment.statusHistory || []).slice().reverse().map((entry, index) => (
                      <li key={`${entry.createdAt}-${index}`} className="flex gap-3 text-xs">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                        <div>
                          <p className="font-semibold text-slate-800">{statusLabels[entry.status] || entry.status} <span className="font-normal text-slate-400">· {dateTime(entry.createdAt)}</span></p>
                          {entry.remarks && <p className="mt-0.5 text-slate-600">{entry.remarks}</p>}
                          {entry.location?.label && <p className="mt-0.5 text-slate-500">{entry.location.label}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </details>
              </article>
            );
          })}
        </div>
      )}

      <footer className="flex items-center justify-between text-xs text-slate-500">
        <span>Page {pagination.page || pageNumber} of {Math.max(pagination.totalPages || 1, 1)}</span>
        <div className="flex gap-2">
          <button type="button" disabled={pageNumber <= 1 || loading} onClick={() => setPageNumber((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold disabled:opacity-40">Previous</button>
          <button type="button" disabled={pageNumber >= (pagination.totalPages || 1) || loading} onClick={() => setPageNumber((current) => current + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold disabled:opacity-40">Next</button>
        </div>
      </footer>
    </div>
  );
}

export default CargoManagement;
