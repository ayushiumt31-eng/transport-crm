import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Database,
  LayoutGrid,
  RefreshCw,
  ShieldCheck,
  Truck,
  WifiOff
} from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { panelByRole, panelOptions, roleMenus } from '../../config/navigation';

const quickPaths = {
  admin: ['/crm/customers', '/bookings/vehicle', '/fleet/allocation', '/drivers/register'],
  manager: ['/bookings/vehicle', '/fleet/allocation', '/drivers/register', '/trips/scheduling'],
  driver: ['/trips/assignment', '/drivers/attendance', '/drivers/licenses', '/notifications/trips'],
  customer: ['/crm/portal', '/bookings/vehicle', '/cargo/tracking', '/billing/invoices']
};

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function ApiStatus({ status, database, error, onRetry, checking }) {
  const isConnected = status === 'ok' || status === 'connected';
  const Icon = error ? WifiOff : isConnected ? CheckCircle2 : CircleDashed;
  const apiLabel = checking ? 'Checking connection' : error ? 'API unavailable' : isConnected ? 'All systems operational' : 'Connection pending';

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${error ? 'bg-rose-50 text-rose-700' : isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          <Icon size={20} />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">System health</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${error ? 'bg-rose-50 text-rose-700' : isConnected ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${error ? 'bg-rose-500' : isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {apiLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Live connection status for your operations workspace.</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-2 text-slate-600"><Activity size={14} className={isConnected ? 'text-emerald-600' : 'text-slate-400'} />API {checking ? 'checking' : error ? 'unavailable' : isConnected ? 'connected' : 'not connected'}</span>
            <span className="inline-flex items-center gap-2 text-slate-600"><Database size={14} className={database === 'connected' ? 'text-emerald-600' : 'text-slate-400'} />Database {checking ? 'checking' : error ? 'unknown' : database || 'unknown'}</span>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={checking}
        className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 sm:self-center"
      >
        <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
        Refresh status
      </button>
    </section>
  );
}

function OverviewCard({ icon: Icon, label, value, detail, accent }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}><Icon size={19} /></span>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{detail}</p>
    </article>
  );
}

export default function DashboardOverview() {
  const { userRole } = useOutletContext() || {};
  const { user } = useAuth();
  const [health, setHealth] = useState({ status: '', database: '', error: '', checking: true });
  const panel = panelByRole[userRole] || panelOptions[0];
  const modules = roleMenus[userRole] || [];
  const availableWorkspaces = useMemo(() => modules.filter((item) => item.submenus?.length), [modules]);
  const accessibleModules = useMemo(
    () => availableWorkspaces.flatMap((item) => item.submenus.map((submenu) => ({ ...submenu, icon: item.icon }))),
    [availableWorkspaces]
  );
  const quickActions = useMemo(() => {
    const byPath = new Map(accessibleModules.map((item) => [item.path, item]));
    const preferred = (quickPaths[userRole] || []).map((path) => byPath.get(path)).filter(Boolean);
    return (preferred.length ? preferred : accessibleModules).slice(0, 4);
  }, [accessibleModules, userRole]);
  const today = useMemo(() => new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date()), []);

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
      <header className="relative isolate overflow-hidden rounded-3xl bg-[#102c27] px-5 py-7 text-white shadow-lg shadow-emerald-950/10 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-12 -top-28 -z-10 h-80 w-80 rounded-full border border-emerald-100/10" />
        <div className="pointer-events-none absolute -right-2 -top-16 -z-10 h-60 w-60 rounded-full border border-emerald-100/10" />
        <div className="pointer-events-none absolute -bottom-28 right-28 -z-10 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
              <ShieldCheck size={13} />
              Operations control center
            </div>
            <p className="mt-5 text-sm font-medium text-emerald-100/75">
              {greetingForHour(new Date().getHours())}{user?.name ? `, ${user.name}` : ''}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{panel.title} dashboard</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/70">
              Your transport operations, teams and tools—organized in one workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-xs font-medium text-emerald-50/85">
              <CalendarDays size={15} className="text-emerald-300" />
              {today}
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {panel.label}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard icon={LayoutGrid} label="Available workspaces" value={availableWorkspaces.length} detail="Sections available in your panel" accent="bg-emerald-50 text-emerald-800" />
        <OverviewCard icon={Truck} label="Available modules" value={accessibleModules.length} detail="Tools you can open from this account" accent="bg-sky-50 text-sky-700" />
        <OverviewCard icon={ShieldCheck} label="Access panel" value={panel.title} detail="Permissions are set by your signed-in role" accent="bg-violet-50 text-violet-700" />
        <OverviewCard icon={Clock3} label="Operations workspace" value="Ready" detail="Choose a shortcut to continue your workflow" accent="bg-amber-50 text-amber-700" />
      </section>

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
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Get things moving</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">Quick actions</h2>
            <p className="mt-1 text-xs text-slate-500">Jump straight into the work you do most.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.path}
                to={action.path}
                className="group flex min-h-36 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800 transition group-hover:bg-emerald-100">
                    <Icon size={19} strokeWidth={1.8} />
                  </span>
                  <ArrowUpRight size={16} className="text-slate-300 transition group-hover:text-emerald-700" />
                </div>
                <div className="mt-5">
                  <h3 className="text-sm font-bold text-slate-900">{action.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Your toolkit</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">All workspaces</h2>
            <p className="mt-1 text-xs text-slate-500">Explore the modules included in your access panel.</p>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600 sm:inline-flex">
            {availableWorkspaces.length} sections
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {availableWorkspaces.map((item) => {
            const Icon = item.icon;
            const firstModule = item.submenus[0];
            return (
              <article
                key={item.title}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-emerald-50 group-hover:text-emerald-800">
                      <Icon size={18} strokeWidth={1.8} />
                    </span>
                    <h3 className="truncate text-sm font-bold text-slate-900">{item.title}</h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                    {item.submenus.length}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {item.submenus.slice(0, 3).map((submenu) => (
                    <Link
                      key={submenu.path}
                      to={submenu.path}
                      className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      {submenu.name}
                    </Link>
                  ))}
                  {item.submenus.length > 3 && (
                    <span className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-400">
                      +{item.submenus.length - 3} more
                    </span>
                  )}
                </div>
                <Link
                  to={firstModule.path}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 transition hover:text-emerald-950"
                >
                  Open workspace
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
