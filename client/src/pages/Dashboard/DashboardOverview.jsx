import React, { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, CircleDashed, RefreshCw, WifiOff } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { panelByRole, panelOptions, roleMenus } from '../../config/navigation';

function ApiStatus({ status, database, error, onRetry, checking }) {
  const isConnected = status === 'ok' || status === 'connected';
  const Icon = error ? WifiOff : isConnected ? CheckCircle2 : CircleDashed;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={17} className="text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-900">System connection</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Live status from the API health endpoint</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={checking}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <Icon size={17} className={error ? 'text-rose-600' : isConnected ? 'text-emerald-700' : 'text-amber-600'} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">API server</p>
            <p className="mt-0.5 text-xs font-bold text-slate-800">
              {checking ? 'Checking…' : error ? 'Unavailable' : isConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <span className={`h-2.5 w-2.5 rounded-full ${database === 'connected' ? 'bg-emerald-500' : database === 'disconnected' ? 'bg-rose-500' : 'bg-slate-300'}`} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Database</p>
            <p className="mt-0.5 text-xs font-bold capitalize text-slate-800">
              {checking ? 'Checking…' : error ? 'Unknown' : database || 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
    </section>
  );
}

export default function DashboardOverview() {
  const { userRole } = useOutletContext() || {};
  const { user } = useAuth();
  const [health, setHealth] = useState({ status: '', database: '', error: '', checking: true });
  const panel = panelByRole[userRole] || panelOptions[0];
  const modules = roleMenus[userRole] || [];

  const loadHealth = useCallback(async () => {
    setHealth((current) => ({ ...current, checking: true, error: '' }));
    try {
      const response = await fetch('/api/health');
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Health check failed (${response.status})`);
      }
      setHealth({
        status: result.status || '',
        database: result.database || '',
        error: '',
        checking: false
      });
    } catch (requestError) {
      setHealth({
        status: '',
        database: '',
        error: requestError.message || 'Unable to reach the API server.',
        checking: false
      });
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="overflow-hidden rounded-2xl bg-[#102c27] px-6 py-7 text-white shadow-sm sm:px-8 sm:py-9">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
              {user?.name ? `Welcome, ${user.name}` : 'Transport operations'}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {panel.label.replace(' Panel', '')} workspace
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/70">
              Choose a workspace below to manage the transport operations available to this panel.
              Operational records will appear here only when returned by the connected backend.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/60">Panel access</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{modules.length - 1} workspaces</p>
          </div>
        </div>
      </header>

      <ApiStatus
        status={health.status}
        database={health.database}
        error={health.error}
        checking={health.checking}
        onRetry={loadHealth}
      />

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Available workspaces</h2>
            <p className="mt-1 text-xs text-slate-500">Modules are grouped once per panel; no duplicate navigation entries.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.filter((item) => item.submenus?.length).map((item) => {
            const Icon = item.icon;
            const firstModule = item.submenus[0];
            return (
              <article
                key={item.title}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
                    <Icon size={19} strokeWidth={1.8} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                    {item.submenus.length} {item.submenus.length === 1 ? 'module' : 'modules'}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">{item.title}</h3>
                <div className="mt-3 space-y-1">
                  {item.submenus.slice(0, 3).map((submenu) => (
                    <p key={submenu.path} className="truncate text-xs text-slate-500">{submenu.name}</p>
                  ))}
                  {item.submenus.length > 3 && (
                    <p className="text-[11px] font-medium text-slate-400">
                      +{item.submenus.length - 3} more
                    </p>
                  )}
                </div>
                <Link
                  to={firstModule.path}
                  className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-emerald-800 transition group-hover:text-emerald-950"
                >
                  Open {firstModule.name}
                  <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
