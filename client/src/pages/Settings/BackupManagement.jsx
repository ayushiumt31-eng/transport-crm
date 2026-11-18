import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Database, Download, LoaderCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../../auth/session';

async function loadBackupStatus() {
  const response = await apiFetch('/settings/backups/status');
  return response.data ?? response;
}

export default function BackupManagement() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStatus(await loadBackupStatus());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function createBackup() {
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch('/settings/backups/local', { method: 'POST', raw: true });
      const archive = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `transport-erp-backup-${new Date().toISOString().slice(0, 10)}.archive.gz`;
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Backup downloaded. Store the archive somewhere separate from this computer.');
    } catch (requestError) {
      setError(requestError.message);
      await refreshStatus();
    } finally {
      setCreating(false);
    }
  }

  const ready = Boolean(status?.connected && status?.mongodumpAvailable);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">System settings</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950"><Database size={22} className="text-emerald-700" />MongoDB backup</h1>
          <p className="mt-1 text-sm text-slate-600">Create a compressed backup of the connected MongoDB database and download it to this device.</p>
        </div>
        <button type="button" onClick={refreshStatus} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh status
        </button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><Check size={16} className="mt-0.5 shrink-0" />{notice}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Backup readiness</h2>
        {loading && <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin" />Checking MongoDB and backup tools…</p>}
        {!loading && status && (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-semibold uppercase text-slate-500">Database</dt><dd className="mt-1 text-sm font-bold text-slate-900">{status.connected ? status.database || 'Connected' : 'Not connected'}</dd></div>
            <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-semibold uppercase text-slate-500">MongoDB Database Tools</dt><dd className={`mt-1 text-sm font-bold ${status.mongodumpAvailable ? 'text-emerald-800' : 'text-amber-800'}`}>{status.mongodumpAvailable ? 'mongodump ready' : 'mongodump not found'}</dd></div>
            <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-semibold uppercase text-slate-500">Restore</dt><dd className="mt-1 text-sm font-bold text-slate-600">{status.restoreEnabled ? 'Enabled' : 'Disabled'}</dd></div>
          </dl>
        )}

        {!loading && status && !status.mongodumpAvailable && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {status.toolMessage || 'Install the official MongoDB Database Tools. If `mongodump` is not on PATH, set `MONGODUMP_PATH` to its executable in the server environment and restart the API.'}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={createBackup} disabled={!ready || creating} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            {creating ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
            {creating ? 'Creating backup…' : 'Create and download backup'}
          </button>
          {!ready && !loading && <span className="text-[11px] text-slate-500">Connect MongoDB and install mongodump to enable backups.</span>}
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-950">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <p>Backup runs against the currently connected database and temporarily uses server disk space. Downloaded archives contain private business data: store them securely and off this computer. Restore is deliberately disabled; this page never overwrites database data.</p>
      </div>
    </div>
  );
}
