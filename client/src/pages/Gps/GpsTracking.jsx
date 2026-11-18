import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bell, Check, CircleStop, LoaderCircle, MapPin, Navigation, Play, RefreshCw, ShieldAlert, Signal, Siren } from 'lucide-react';
import { apiFetch } from '../../auth/session';
import { useAuth } from '../../auth/AuthContext';

const pageDetails = {
  '/gps/live': { title: 'Live vehicle tracking', description: 'View current trip locations and share the assigned driver’s phone location.' },
  '/gps/route': { title: 'Trip route tracking', description: 'Review the recorded GPS breadcrumb for a selected trip.' },
  '/gps/geofencing': { title: 'Geofencing', description: 'Create circular service-area zones and review entry/exit alerts.' },
  '/gps/history': { title: 'Location history', description: 'Review GPS points recorded for an assigned or completed trip.' },
  '/gps/speed': { title: 'Speed monitoring', description: 'Review device-reported or GPS-derived speeds and threshold alerts.' },
  '/gps/alerts': { title: 'GPS alerts', description: 'Review speed threshold and geofence transition alerts.' }
};

let mapsLoadPromise;

async function gpsRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

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

function GpsMap({ apiKey, trips, locations, geofences, onError }) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);

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
    }).catch((error) => onError(error.message));
    return () => { active = false; };
  }, [apiKey, onError]);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const bounds = new maps.LatLngBounds();
    let pointCount = 0;
    const addMarker = (position, title, icon) => {
      const marker = new maps.Marker({ map, position, title, ...(icon ? { icon } : {}) });
      overlaysRef.current.push(marker);
      bounds.extend(position);
      pointCount += 1;
    };
    trips.forEach((trip) => {
      const position = trip.lastLocation;
      if (position) addMarker(
        { lat: position.latitude, lng: position.longitude },
        `${trip.tripNumber} · ${trip.vehicleId?.registrationNumber || 'Vehicle'}`
      );
    });
    if (locations.length) {
      const ordered = [...locations].sort((left, right) => new Date(left.recordedAt) - new Date(right.recordedAt));
      const path = ordered.map((location) => ({ lat: location.latitude, lng: location.longitude }));
      path.forEach((position, index) => {
        if (index === 0 || index === path.length - 1) addMarker(position, index === 0 ? 'First recorded point' : 'Latest recorded point');
        else bounds.extend(position);
      });
      if (path.length > 1) {
        const line = new maps.Polyline({ map, path, geodesic: true, strokeColor: '#047857', strokeOpacity: 0.9, strokeWeight: 4 });
        overlaysRef.current.push(line);
      }
    }
    geofences.forEach((zone) => {
      const center = { lat: zone.latitude, lng: zone.longitude };
      const circle = new maps.Circle({
        map,
        center,
        radius: zone.radiusMeters,
        strokeColor: '#b45309',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#f59e0b',
        fillOpacity: 0.12
      });
      overlaysRef.current.push(circle);
      addMarker(center, `${zone.name} · ${zone.radiusMeters} m`);
    });
    if (pointCount) map.fitBounds(bounds, 48);
  }, [trips, locations, geofences]);

  return <div ref={elementRef} className="h-[420px] w-full rounded-xl bg-slate-100" aria-label="Map showing GPS locations and geofences" />;
}

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function tripTitle(trip) {
  return `${trip.tripNumber} · ${trip.vehicleId?.registrationNumber || 'Vehicle'} · ${trip.tripStatus}`;
}

export default function GpsTracking({ path = window.location.pathname }) {
  const page = pageDetails[path] || pageDetails['/gps/live'];
  const { role } = useAuth();
  const isStaff = role === 'admin' || role === 'manager';
  const isDriver = role === 'driver';
  const watchIdRef = useRef(null);
  const lastSentAtRef = useRef(0);
  const sendInFlightRef = useRef(false);
  const [mapKey, setMapKey] = useState('');
  const [trips, setTrips] = useState([]);
  const [historyTrips, setHistoryTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [locations, setLocations] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [geofenceDraft, setGeofenceDraft] = useState({ name: '', latitude: '', longitude: '', radiusMeters: '250' });
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mapError, setMapError] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';
  const selectedTrip = useMemo(
    () => [...trips, ...historyTrips].find((trip) => trip._id === selectedTripId) || null,
    [trips, historyTrips, selectedTripId]
  );
  const displayedAlerts = path === '/gps/speed'
    ? alerts.filter((alert) => alert.type === 'SpeedLimitExceeded')
    : alerts;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const configPromise = gpsRequest('/gps/map-config');
      const requests = [configPromise];
      if (['/gps/live', '/gps/route', '/gps/speed', '/gps/history'].includes(path)) {
        requests.push(gpsRequest('/gps/active?page=1&limit=100'));
      }
      if (['/gps/history', '/gps/speed'].includes(path)) requests.push(gpsRequest('/trips/history?page=1&limit=100'));
      if (path === '/gps/geofencing' || path === '/gps/live' || path === '/gps/route') requests.push(gpsRequest('/gps/geofences'));
      if (path === '/gps/alerts' || path === '/gps/speed') requests.push(gpsRequest('/gps/alerts?page=1&limit=100'));
      const results = await Promise.all(requests);
      let resultIndex = 0;
      const config = results[resultIndex++];
      setMapKey(config.apiKey);
      if (['/gps/live', '/gps/route', '/gps/speed', '/gps/history'].includes(path)) {
        const activeResult = results[resultIndex++];
        setTrips(activeResult.data || []);
      } else {
        setTrips([]);
      }
      if (['/gps/history', '/gps/speed'].includes(path)) {
        const historyResult = results[resultIndex++];
        setHistoryTrips(historyResult.data || []);
      } else {
        setHistoryTrips([]);
      }
      if (path === '/gps/geofencing' || path === '/gps/live' || path === '/gps/route') {
        setGeofences(results[resultIndex++] || []);
      } else {
        setGeofences([]);
      }
      if (path === '/gps/alerts' || path === '/gps/speed') {
        const alertResult = results[resultIndex++];
        setAlerts(alertResult.data || []);
        setPagination(alertResult.pagination || { total: 0, page: 1, totalPages: 0 });
      } else {
        setAlerts([]);
      }
      setMapError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  const loadLocations = useCallback(async (tripId) => {
    if (!tripId) {
      setLocations([]);
      return;
    }
    const result = await gpsRequest(`/gps/trips/${encodeURIComponent(tripId)}/locations?page=1&limit=500`);
    setLocations(result.data || []);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const allTrips = [...trips, ...historyTrips];
    if (selectedTripId && allTrips.some((trip) => trip._id === selectedTripId)) return;
    const nextTrip = path === '/gps/history' ? (historyTrips[0] || trips[0]) : (trips[0] || historyTrips[0]);
    setSelectedTripId(nextTrip?._id || '');
  }, [trips, historyTrips, selectedTripId, path]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (['/gps/live', '/gps/route'].includes(path) && !sharing) loadData();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadData, path, sharing]);

  useEffect(() => {
    if (!selectedTripId || !['/gps/route', '/gps/history', '/gps/speed'].includes(path)) {
      setLocations([]);
      return;
    }
    let active = true;
    loadLocations(selectedTripId).catch((requestError) => {
      if (active) setError(requestError.message);
    });
    const timer = path === '/gps/route' ? window.setInterval(() => {
      loadLocations(selectedTripId).catch((requestError) => setError(requestError.message));
    }, 15000) : null;
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [selectedTripId, path, loadLocations]);

  useEffect(() => () => {
    if (watchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  function stopSharing() {
    if (watchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    sendInFlightRef.current = false;
    setSharing(false);
  }

  function startSharing() {
    if (!navigator.geolocation) {
      setError('This browser does not support geolocation.');
      return;
    }
    if (!selectedTrip || !['InProgress', 'Delayed'].includes(selectedTrip.tripStatus)) {
      setError('Start or resume your assigned trip before sharing GPS location.');
      return;
    }
    setError('');
    setNotice('Requesting location permission. Keep this page open while sharing.');
    lastSentAtRef.current = 0;
    setSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(async (position) => {
      if (sendInFlightRef.current || Date.now() - lastSentAtRef.current < 15000) return;
      sendInFlightRef.current = true;
      lastSentAtRef.current = Date.now();
      const { latitude, longitude, accuracy, speed, heading } = position.coords;
      try {
        const result = await gpsRequest(`/gps/trips/${encodeURIComponent(selectedTrip._id)}/location`, {
          method: 'POST',
          body: {
            latitude,
            longitude,
            accuracyMeters: accuracy,
            speedMetersPerSecond: speed,
            headingDegrees: heading,
            recordedAt: new Date(position.timestamp).toISOString()
          }
        });
        setNotice(`Location shared at ${dateTime(result.location.recordedAt)}. Sharing stops when you close this page or tap Stop.`);
        await Promise.all([loadData(), loadLocations(selectedTrip._id)]);
      } catch (requestError) {
        setError(requestError.message);
        stopSharing();
      } finally {
        sendInFlightRef.current = false;
      }
    }, (geoError) => {
      const messages = {
        1: 'Location permission was denied. Allow location access in your browser settings to share.',
        2: 'Your device could not determine a location. Check device location services and try again.',
        3: 'The location request timed out. Check GPS reception and retry.'
      };
      setError(messages[geoError.code] || geoError.message || 'Could not read the device location.');
      stopSharing();
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }

  async function createGeofence(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await gpsRequest('/gps/geofences', {
        method: 'POST',
        body: {
          ...geofenceDraft,
          latitude: Number(geofenceDraft.latitude),
          longitude: Number(geofenceDraft.longitude),
          radiusMeters: Number(geofenceDraft.radiusMeters)
        }
      });
      setNotice(`Geofence "${result.name}" created.`);
      setGeofenceDraft({ name: '', latitude: '', longitude: '', radiusMeters: '250' });
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function archiveGeofence(geofence) {
    if (!window.confirm(`Archive geofence "${geofence.name}"?`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await gpsRequest(`/gps/geofences/${encodeURIComponent(geofence._id)}/archive`, { method: 'PATCH' });
      setNotice(`Geofence "${geofence.name}" archived.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const mapTrips = path === '/gps/live' ? trips : [];
  const geofencePage = path === '/gps/geofencing';
  const alertPage = path === '/gps/alerts' || path === '/gps/speed';
  const routePage = ['/gps/route', '/gps/history', '/gps/speed'].includes(path);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">GPS tracking</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950"><Navigation size={22} className="text-emerald-700" />{page.title}</h1><p className="mt-1 text-sm text-slate-600">{page.description}</p></div>
        <button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
      </header>
      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={16} className="mt-0.5 shrink-0" />{notice}</div>}
      <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">Location is collected only for an active assigned trip after the driver starts sharing. This browser must remain open; background tracking and dedicated vehicle tracker devices are not connected. Browser location requires permission and HTTPS in deployment. Maps API keys are public in browsers: restrict this key to your site referrers and the Maps JavaScript API.</p>

      {isDriver && path === '/gps/live' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold text-slate-700">Your active trip
            <select disabled={sharing} value={selectedTripId} onChange={(event) => setSelectedTripId(event.target.value)} className={inputClass}>
              <option value="">Select an in-progress or delayed trip</option>
              {trips.map((trip) => <option key={trip._id} value={trip._id}>{tripTitle(trip)}</option>)}
            </select>
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!sharing
              ? <button type="button" onClick={startSharing} disabled={!selectedTrip || !['InProgress', 'Delayed'].includes(selectedTrip.tripStatus)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Play size={14} />Start location sharing</button>
              : <button type="button" onClick={stopSharing} className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2.5 text-xs font-bold text-white"><CircleStop size={14} />Stop sharing</button>}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${sharing ? 'text-emerald-800' : 'text-slate-500'}`}><Signal size={14} />{sharing ? 'Sharing while this page stays open' : 'Not sharing'}</span>
          </div>
        </section>
      )}

      {routePage && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold text-slate-700">Trip
            <select value={selectedTripId} onChange={(event) => setSelectedTripId(event.target.value)} className={inputClass}>
              <option value="">Select a trip</option>
              {[...trips, ...historyTrips].map((trip) => <option key={trip._id} value={trip._id}>{tripTitle(trip)}</option>)}
            </select>
          </label>
          {selectedTrip && <p className="mt-2 text-xs text-slate-500">{selectedTrip.routeId ? `Trip route reference: ${selectedTrip.routeId}.` : 'No route reference is recorded.'} The map line connects recorded GPS points only; it does not calculate road directions.</p>}
        </section>
      )}

      {mapKey && (path === '/gps/live' || path === '/gps/route' || path === '/gps/history') && (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <GpsMap apiKey={mapKey} trips={mapTrips} locations={selectedTrip ? locations : []} geofences={geofences} onError={setMapError} />
          {mapError && <p role="alert" className="text-xs text-rose-700">{mapError}</p>}
          <p className="flex items-center gap-1 text-[11px] text-slate-500"><MapPin size={13} />Map data updates while the page is open. Last known points are not guaranteed to be live.</p>
        </section>
      )}

      {path === '/gps/live' && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Signal size={17} />Active trips</h2>
          {loading ? <Loading /> : <div className="grid gap-3 md:grid-cols-2">{trips.map((trip) => (
            <article key={trip._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-emerald-800">{trip.tripNumber}</p><p className="mt-1 text-sm font-bold text-slate-900">{trip.vehicleId?.registrationNumber || 'Vehicle'}</p><p className="text-xs text-slate-500">{trip.driverId?.personalInfo?.fullName || trip.driverId?.driverCode || 'Driver'} · {trip.tripStatus}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{trip.tripStatus}</span></div>
              {trip.lastLocation ? <p className="mt-3 text-xs text-slate-600">Last update {dateTime(trip.lastLocation.recordedAt)} · {trip.lastLocation.latitude.toFixed(5)}, {trip.lastLocation.longitude.toFixed(5)} · ±{Math.round(trip.lastLocation.accuracyMeters)} m {trip.lastLocation.speedKmh != null ? `· ${trip.lastLocation.speedKmh} km/h` : ''}</p> : <p className="mt-3 text-xs text-amber-700">Waiting for the driver to share a location.</p>}
            </article>
          ))}{!trips.length && <Empty>No active assigned trips.</Empty>}</div>}
        </section>
      )}

      {geofencePage && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {isStaff && <form onSubmit={createGeofence} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-950">Create a circular geofence</h2>
            <p className="text-xs text-slate-500">Enter the zone centre coordinates from a trusted source; the saved circle is shown on the map.</p>
            <label className="block text-xs font-semibold text-slate-700">Zone name<input required minLength={2} maxLength={120} value={geofenceDraft.name} onChange={(event) => setGeofenceDraft({ ...geofenceDraft, name: event.target.value })} className={inputClass} /></label>
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-700">Latitude<input required type="number" min="-90" max="90" step="any" value={geofenceDraft.latitude} onChange={(event) => setGeofenceDraft({ ...geofenceDraft, latitude: event.target.value })} className={inputClass} /></label><label className="text-xs font-semibold text-slate-700">Longitude<input required type="number" min="-180" max="180" step="any" value={geofenceDraft.longitude} onChange={(event) => setGeofenceDraft({ ...geofenceDraft, longitude: event.target.value })} className={inputClass} /></label></div>
            <label className="block text-xs font-semibold text-slate-700">Radius (metres)<input required type="number" min="50" max="100000" step="1" value={geofenceDraft.radiusMeters} onChange={(event) => setGeofenceDraft({ ...geofenceDraft, radiusMeters: event.target.value })} className={inputClass} /></label>
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Create geofence'}</button>
          </form>}
          <div className="space-y-3">{mapKey && <GpsMap apiKey={mapKey} trips={[]} locations={[]} geofences={geofences} onError={setMapError} />}{mapError && <p role="alert" className="text-xs text-rose-700">{mapError}</p>}
            <div className="space-y-2">{geofences.map((zone) => <article key={zone._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div><p className="text-sm font-bold text-slate-900">{zone.name}</p><p className="mt-1 text-xs text-slate-500">{zone.latitude.toFixed(5)}, {zone.longitude.toFixed(5)} · radius {zone.radiusMeters} m</p></div>{isStaff && <button type="button" disabled={saving} onClick={() => archiveGeofence(zone)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Archive</button>}</article>)}{!geofences.length && <Empty>No active geofences configured.</Empty>}</div>
          </div>
        </section>
      )}

      {alertPage && (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-bold text-slate-900">{path === '/gps/speed' ? <Siren size={17} /> : <Bell size={17} />}{path === '/gps/speed' ? 'Speed threshold alerts' : 'Recent GPS alerts'}</h2><span className="text-xs text-slate-500">{pagination.total} record(s)</span></div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[700px] text-left"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Alert</th><th className="px-4 py-3">Trip / vehicle</th><th className="px-4 py-3">Driver / value</th></tr></thead><tbody className="divide-y divide-slate-100">
              {displayedAlerts.map((alert) => <tr key={alert._id}><td className="px-4 py-3 text-xs text-slate-600">{dateTime(alert.recordedAt)}</td><td className="px-4 py-3 text-xs font-semibold text-slate-800">{alert.type === 'SpeedLimitExceeded' ? <span className="inline-flex items-center gap-1"><ShieldAlert size={13} className="text-amber-600" />Speed threshold</span> : alert.type === 'GeofenceEntered' ? 'Geofence entered' : 'Geofence exited'}<p className="mt-1 font-normal text-slate-500">{alert.message}</p></td><td className="px-4 py-3 text-xs text-slate-700">{alert.tripId?.tripNumber || '—'} · {alert.vehicleId?.registrationNumber || '—'}</td><td className="px-4 py-3 text-xs text-slate-700">{alert.driverId?.personalInfo?.fullName || alert.driverId?.driverCode || '—'}{alert.speedKmh != null ? ` · ${alert.speedKmh} km/h` : ''}</td></tr>)}
              {!displayedAlerts.length && <tr><td colSpan="4" className="px-4 py-10 text-center text-sm text-slate-500">No GPS alerts recorded.</td></tr>}
            </tbody></table>
          </div>
          <p className="text-[11px] text-slate-500">Speed threshold is configured at {import.meta.env.VITE_GPS_SPEED_ALERT_LIMIT_KMH || '80'} km/h on the API. Phone GPS speed and coordinates are device-reported and may be inaccurate; alerts are operational indicators, not legal evidence.</p>
        </section>
      )}

      {routePage && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-base font-bold text-slate-900">Recorded locations</h2><span className="text-xs text-slate-500">{locations.length} point(s)</span></div>
          {path === '/gps/speed' ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{locations.filter((location) => location.speedKmh != null).slice(0, 60).map((location) => <article key={location._id} className="rounded-lg border border-slate-200 p-3"><p className="text-sm font-bold text-slate-900">{location.speedKmh} km/h</p><p className="mt-1 text-[11px] text-slate-500">{dateTime(location.recordedAt)} · accuracy ±{Math.round(location.accuracyMeters)} m</p></article>)}{selectedTrip && !locations.some((location) => location.speedKmh != null) && <Empty>No speed readings are available for this trip yet.</Empty>}</div>
          ) : <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">{locations.map((location) => <div key={location._id} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span className="font-semibold text-slate-800">{dateTime(location.recordedAt)} · {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span><span className="text-slate-500">±{Math.round(location.accuracyMeters)} m{location.speedKmh != null ? ` · ${location.speedKmh} km/h` : ''}</span></div>)}{selectedTrip && !locations.length && <Empty>No GPS points recorded for this trip.</Empty>}</div>}
        </section>
      )}
      {loading && path !== '/gps/live' && <Loading />}
    </div>
  );
}

function Loading() {
  return <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin text-emerald-700" />Loading GPS records…</div>;
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">{children}</div>;
}
