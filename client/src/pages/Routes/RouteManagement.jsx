import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, Plus, RefreshCw, Route as RouteIcon, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '../../auth/session';
import { useAuth } from '../../auth/AuthContext';

const pageDetails = {
  '/routes/create': { title: 'Route creation', description: 'Create and maintain a manually verified route catalogue.' },
  '/routes/distance': { title: 'Distance management', description: 'Review recorded route distances and estimated transit times.' },
  '/routes/optimization': { title: 'Route recommendations', description: 'Rank saved routes by recorded distance, time, and toll data.' },
  '/routes/tolls': { title: 'Toll tracking', description: 'Maintain toll plaza costs and vehicle-specific applicability.' }
};

const vehicleTypes = ['Truck', 'Trailer', 'Container', 'Pickup', 'Tempo', 'Tanker', 'Van', 'Other'];
const initialRoute = () => ({
  name: '', origin: '', destination: '', distanceKm: '', estimatedDurationMinutes: '',
  waypoints: '', notes: '', tolls: []
});

async function routeRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

function currency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount || 0));
}

function RouteManagement({ path }) {
  const page = pageDetails[path] || pageDetails['/routes/distance'];
  const { role } = useAuth();
  const isStaff = role === 'admin' || role === 'manager';
  const [routes, setRoutes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 });
  const [pageNumber, setPageNumber] = useState(1);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(initialRoute);
  const [editing, setEditing] = useState(null);
  const [suggestionQuery, setSuggestionQuery] = useState({ origin: '', destination: '', vehicleType: 'Truck', avoidTolls: false });
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(pageNumber), limit: '20' });
      if (search.trim()) params.set('search', search.trim());
      const result = await routeRequest(`/routes?${params}`);
      setRoutes(result.data || []);
      setPagination(result.pagination || { page: pageNumber, totalPages: 0, total: 0 });
    } catch (requestError) {
      setRoutes([]);
      setPagination({ page: pageNumber, totalPages: 0, total: 0 });
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [pageNumber, search]);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  function beginEdit(route) {
    setEditing(route);
    setDraft({
      name: route.name,
      origin: route.origin,
      destination: route.destination,
      distanceKm: String(route.distanceKm),
      estimatedDurationMinutes: String(route.estimatedDurationMinutes),
      waypoints: (route.waypoints || []).join('\n'),
      notes: route.notes || '',
      tolls: (route.tolls || []).map((toll) => ({
        name: toll.name,
        location: toll.location,
        amount: String(toll.amount ?? toll.amountPaise / 100),
        vehicleTypes: toll.vehicleTypes || [],
        notes: toll.notes || ''
      }))
    });
  }

  function addToll() {
    setDraft((current) => ({ ...current, tolls: [...current.tolls, { name: '', location: '', amount: '', vehicleTypes: [], notes: '' }] }));
  }

  function updateToll(index, key, value) {
    setDraft((current) => ({
      ...current,
      tolls: current.tolls.map((toll, tollIndex) => tollIndex === index ? { ...toll, [key]: value } : toll)
    }));
  }

  async function saveRoute(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        ...draft,
        distanceKm: Number(draft.distanceKm),
        estimatedDurationMinutes: Number(draft.estimatedDurationMinutes),
        waypoints: draft.waypoints.split(/\n|,/).map((value) => value.trim()).filter(Boolean),
        tolls: draft.tolls.map((toll) => ({ ...toll, amount: Number(toll.amount) }))
      };
      const result = await routeRequest(editing ? `/routes/${encodeURIComponent(editing._id)}` : '/routes', {
        method: editing ? 'PATCH' : 'POST',
        body: payload
      });
      setNotice(`${result.routeNumber} ${editing ? 'updated' : 'created'} successfully.`);
      setEditing(null);
      setDraft(initialRoute());
      await loadRoutes();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function getSuggestions(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuggestions([]);
    try {
      const params = new URLSearchParams({
        ...suggestionQuery,
        avoidTolls: String(suggestionQuery.avoidTolls),
        limit: '10'
      });
      const result = await routeRequest(`/routes/suggestions?${params}`);
      setSuggestions(result.candidates || []);
      if (!result.candidates?.length) setNotice('No exact origin/destination match is in the saved route catalogue.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function archiveRoute(route) {
    const remarks = window.prompt(`Why are you archiving ${route.routeNumber}?`);
    if (!remarks?.trim()) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await routeRequest(`/routes/${encodeURIComponent(route._id)}/archive`, { method: 'PATCH', body: { remarks: remarks.trim() } });
      setNotice(`${route.routeNumber} archived. Existing trip snapshots remain unchanged.`);
      await loadRoutes();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const routeForm = (isEditing) => (
    <form onSubmit={saveRoute} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-bold text-slate-950">{isEditing ? `Edit ${editing.routeNumber}` : 'Add a saved route'}</h2>
        <p className="mt-1 text-xs text-slate-500">Enter checked operational data. No map provider or live traffic service is connected.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700">Route name<input required minLength={2} maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass} /></label>
        <label className="text-xs font-semibold text-slate-700">Origin<input required minLength={2} maxLength={120} value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })} className={inputClass} /></label>
        <label className="text-xs font-semibold text-slate-700">Destination<input required minLength={2} maxLength={120} value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} className={inputClass} /></label>
        <label className="text-xs font-semibold text-slate-700">Distance (km)<input required type="number" min="0.1" max="100000" step="0.1" value={draft.distanceKm} onChange={(event) => setDraft({ ...draft, distanceKm: event.target.value })} className={inputClass} /></label>
        <label className="text-xs font-semibold text-slate-700">Estimated duration (minutes)<input required type="number" min="1" max="1000000" step="1" value={draft.estimatedDurationMinutes} onChange={(event) => setDraft({ ...draft, estimatedDurationMinutes: event.target.value })} className={inputClass} /></label>
        <label className="text-xs font-semibold text-slate-700">Waypoints (one per line)<textarea rows={2} maxLength={5000} value={draft.waypoints} onChange={(event) => setDraft({ ...draft, waypoints: event.target.value })} className={inputClass} /></label>
      </div>
      <label className="block text-xs font-semibold text-slate-700">Route notes<textarea rows={2} maxLength={2000} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className={inputClass} /></label>
      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-800">Toll plazas</h3><button type="button" onClick={addToll} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"><Plus size={13} />Add toll</button></div>
        {draft.tolls.map((toll, index) => (
          <div key={index} className="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Toll name<input required minLength={2} maxLength={150} value={toll.name} onChange={(event) => updateToll(index, 'name', event.target.value)} className={inputClass} /></label>
            <label className="text-xs font-semibold text-slate-700">Location<input required minLength={2} maxLength={200} value={toll.location} onChange={(event) => updateToll(index, 'location', event.target.value)} className={inputClass} /></label>
            <label className="text-xs font-semibold text-slate-700">Fee (INR)<input required type="number" min="0.01" max="10000000" step="0.01" value={toll.amount} onChange={(event) => updateToll(index, 'amount', event.target.value)} className={inputClass} /></label>
            <label className="text-xs font-semibold text-slate-700">Applicable vehicle types (blank means all)
              <select multiple size={3} value={toll.vehicleTypes} onChange={(event) => updateToll(index, 'vehicleTypes', [...event.target.selectedOptions].map((option) => option.value))} className={inputClass}>
                {vehicleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <div className="flex items-end justify-between gap-3 md:col-span-2"><p className="text-[11px] text-slate-500">Use Ctrl/Command to select more than one type.</p><button type="button" onClick={() => setDraft((current) => ({ ...current, tolls: current.tolls.filter((_, tollIndex) => tollIndex !== index) }))} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Trash2 size={13} />Remove</button></div>
          </div>
        ))}
        {!draft.tolls.length && <p className="text-xs text-slate-500">No toll data recorded.</p>}
      </div>
      <div className="flex justify-end gap-2">
        {isEditing && <button type="button" onClick={() => { setEditing(null); setDraft(initialRoute()); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>}
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}{isEditing ? 'Save route changes' : 'Create route'}</button>
      </div>
    </form>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">Route management</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950"><RouteIcon size={22} className="text-emerald-700" />{page.title}</h1><p className="mt-1 text-sm text-slate-600">{page.description}</p></div>
        <button type="button" onClick={loadRoutes} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
      </header>
      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={16} />{notice}</div>}

      {path === '/routes/optimization' ? (
        <section className="space-y-4">
          <form onSubmit={getSuggestions} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Origin<input required minLength={2} value={suggestionQuery.origin} onChange={(event) => setSuggestionQuery({ ...suggestionQuery, origin: event.target.value })} className={inputClass} /></label>
            <label className="text-xs font-semibold text-slate-700">Destination<input required minLength={2} value={suggestionQuery.destination} onChange={(event) => setSuggestionQuery({ ...suggestionQuery, destination: event.target.value })} className={inputClass} /></label>
            <label className="text-xs font-semibold text-slate-700">Vehicle type<select value={suggestionQuery.vehicleType} onChange={(event) => setSuggestionQuery({ ...suggestionQuery, vehicleType: event.target.value })} className={inputClass}>{vehicleTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="flex items-center gap-2 self-end pb-3 text-xs font-semibold text-slate-700"><input type="checkbox" checked={suggestionQuery.avoidTolls} onChange={(event) => setSuggestionQuery({ ...suggestionQuery, avoidTolls: event.target.checked })} />Exclude routes with recorded toll costs</label>
            <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 md:col-span-2"><Search size={14} />Rank saved routes</button>
          </form>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Recommendations use manually entered route catalogue values only. They are not map directions, live traffic estimates, or GPS routing.</p>
          <RouteCards routes={suggestions} />
        </section>
      ) : (
        <>
          {path === '/routes/create' && isStaff && !editing && routeForm(false)}
          {editing && isStaff && routeForm(true)}
          <section className="space-y-3">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative block w-full sm:max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPageNumber(1); }} placeholder="Search route, city, toll…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-700" /></label>
              <span className="text-xs text-slate-500">{pagination.total} route(s)</span>
            </div>
            {path === '/routes/tolls' ? <TollCards routes={routes} isStaff={isStaff} onEdit={beginEdit} /> : <RouteCards routes={routes} isStaff={isStaff} onEdit={beginEdit} onArchive={archiveRoute} showDistance />}
            {!loading && !routes.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No routes found. {isStaff ? 'Create a saved route to begin.' : ''}</div>}
            <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
              <button type="button" onClick={() => setPageNumber((current) => Math.max(1, current - 1))} disabled={loading || pageNumber <= 1} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40">Previous</button>
              <span>Page {pagination.page || pageNumber}{pagination.totalPages ? ` / ${pagination.totalPages}` : ''}</span>
              <button type="button" onClick={() => setPageNumber((current) => current + 1)} disabled={loading || !pagination.totalPages || pageNumber >= pagination.totalPages} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40">Next</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function RouteCards({ routes, isStaff = false, onEdit, onArchive, showDistance = false }) {
  if (!routes.length) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No saved route records to show.</div>;
  return (
    <div className="grid gap-3">
      {routes.map((route, index) => (
        <article key={route._id || route.routeNumber} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div><p className="text-xs font-bold text-emerald-800">{route.routeNumber || `Recommendation ${index + 1}`} · {route.name}</p><h2 className="mt-1 text-base font-bold text-slate-950">{route.origin} → {route.destination}</h2><p className="mt-1 text-xs text-slate-600">{route.waypoints?.length ? route.waypoints.join(' · ') : 'No intermediate waypoints recorded'}</p></div>
            {isStaff && onEdit && <div className="flex gap-2"><button type="button" onClick={() => onEdit(route)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>{onArchive && <button type="button" onClick={() => onArchive(route)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Archive</button>}</div>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-700">
            {(showDistance || route.distanceKm != null) && <span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{route.distanceKm} km</span>}
            {route.estimatedDurationMinutes != null && <span className="rounded-lg bg-slate-100 px-2.5 py-1.5">~{route.estimatedDurationMinutes} min</span>}
            {route.estimatedTollPaise != null && <span className="rounded-lg bg-slate-100 px-2.5 py-1.5">Estimated toll {currency(route.estimatedTollPaise / 100)}</span>}
            {route.rankingBasis && <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-800">{route.rankingBasis}</span>}
          </div>
        </article>
      ))}
    </div>
  );
}

function TollCards({ routes, isStaff, onEdit }) {
  if (!routes.length) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No saved routes to show.</div>;
  return (
    <div className="grid gap-3">
      {routes.map((route) => (
        <article key={route._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between gap-3"><div><p className="text-xs font-bold text-emerald-800">{route.routeNumber}</p><h2 className="mt-1 text-sm font-bold text-slate-950">{route.origin} → {route.destination}</h2></div>{isStaff && <button type="button" onClick={() => onEdit(route)} className="self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Edit tolls</button>}</div>
          {route.tolls?.length ? <div className="mt-3 divide-y divide-slate-100">{route.tolls.map((toll) => <div key={toll._id || `${toll.name}-${toll.location}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span className="font-semibold text-slate-800">{toll.name} · {toll.location}<span className="block font-normal text-slate-500">{toll.vehicleTypes?.length ? toll.vehicleTypes.join(', ') : 'All vehicle types'}</span></span><span className="font-bold text-slate-800">{currency(toll.amount ?? toll.amountPaise / 100)}</span></div>)}</div> : <p className="mt-3 text-xs text-slate-500">No tolls recorded.</p>}
        </article>
      ))}
    </div>
  );
}

export default RouteManagement;
