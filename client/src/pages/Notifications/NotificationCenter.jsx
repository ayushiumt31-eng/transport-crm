import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Bell, Check, CheckCheck, LoaderCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../auth/session';

const pageDetails = {
  '/notifications/sms': { title: 'SMS alerts', channel: 'SMS' },
  '/notifications/email': { title: 'Email notifications', channel: 'Email' },
  '/notifications/push': { title: 'Push notifications', channel: 'Push' },
  '/notifications/trips': { title: 'Trip alerts', channel: 'In-app' }
};

function dateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

async function notificationRequest(path, options = {}) {
  const result = await apiFetch(path, options);
  return result.data ?? result;
}

export default function NotificationCenter({ path = window.location.pathname }) {
  const page = pageDetails[path] || pageDetails['/notifications/trips'];
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [category, setCategory] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadNotifications = useCallback(async (pageNumber = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(pageNumber), limit: '20' });
      if (category) params.set('category', category);
      if (unreadOnly) params.set('unreadOnly', 'true');
      const result = await notificationRequest(`/notifications?${params}`);
      setNotifications(result.data || []);
      setPagination(result.pagination || { page: pageNumber, totalPages: 0, total: 0 });
      setUnreadCount(result.unreadCount || 0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [category, unreadOnly]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  async function markAsRead(notification) {
    if (notification.readAt) return;
    setSavingId(notification._id);
    setError('');
    setNotice('');
    try {
      await notificationRequest(`/notifications/${encodeURIComponent(notification._id)}/read`, { method: 'PATCH' });
      setNotice('Notification marked as read.');
      await loadNotifications(pagination.page);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingId('');
    }
  }

  async function markAllAsRead() {
    setSavingId('all');
    setError('');
    setNotice('');
    try {
      const result = await notificationRequest('/notifications/read-all', { method: 'PATCH' });
      setNotice(`${result.updatedCount || 0} notification(s) marked as read.`);
      await loadNotifications(pagination.page);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingId('');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">Notification center</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950"><Bell size={22} className="text-emerald-700" />{page.title}</h1>
          <p className="mt-1 text-sm text-slate-600">Trip status and GPS events are saved here as personal in-app alerts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900"><Bell size={14} />{unreadCount} unread</span>
          <button type="button" onClick={() => loadNotifications(pagination.page)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
          <button type="button" onClick={markAllAsRead} disabled={!unreadCount || savingId !== ''} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"><CheckCheck size={14} />Mark all read</button>
        </div>
      </header>

      {path !== '/notifications/trips' && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">{page.channel} delivery is not configured.</p>
        <p className="mt-1 text-xs leading-5 text-amber-900">This build does not have an SMS, email, or push provider connected, so it will not claim external messages were sent. Trip and GPS events are available in the in-app alert feed.</p>
      </section>}

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={16} />{notice}</div>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-bold text-slate-900">Alert history</h2><p className="mt-0.5 text-xs text-slate-500">{pagination.total} notification(s)</p></div>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="notification-category">Filter by event type</label>
            <select id="notification-category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
              <option value="">All events</option><option value="trip">Trip events</option><option value="gps">GPS alerts</option>
            </select>
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />Unread only</label>
          </div>
        </div>

        {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" />Loading alerts…</div>
          : notifications.length === 0 ? <div className="p-12 text-center"><Bell size={24} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No notifications to show</p><p className="mt-1 text-xs text-slate-500">Trip and GPS alerts will appear here when events occur.</p></div>
            : <ul className="divide-y divide-slate-100">
              {notifications.map((notification) => <li key={notification._id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between ${notification.readAt ? 'bg-white' : 'bg-emerald-50/50'}`}>
                <div className="flex min-w-0 gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? 'bg-slate-300' : 'bg-emerald-600'}`} aria-label={notification.readAt ? 'Read' : 'Unread'} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900">{notification.title}</h3><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{notification.category}</span>{notification.tripNumber && <span className="text-xs font-medium text-slate-600">{notification.tripNumber}</span>}</div>
                    <p className="mt-1 text-sm leading-5 text-slate-700">{notification.message}</p>
                    <time className="mt-2 block text-[11px] text-slate-500" dateTime={notification.createdAt}>{dateTime(notification.createdAt)}</time>
                  </div>
                </div>
                {!notification.readAt && <button type="button" onClick={() => markAsRead(notification)} disabled={savingId !== ''} className="ml-5 inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Check size={13} />{savingId === notification._id ? 'Saving…' : 'Mark read'}</button>}
              </li>)}
            </ul>}

        {pagination.totalPages > 1 && <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <button type="button" disabled={loading || pagination.page <= 1} onClick={() => loadNotifications(pagination.page - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-45">Previous</button>
          <span className="text-xs text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
          <button type="button" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => loadNotifications(pagination.page + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-45">Next</button>
        </footer>}
      </section>
    </div>
  );
}
