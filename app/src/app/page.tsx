'use client';

import { useEffect, useState, useCallback } from 'react';

interface ServiceData {
  id: string;
  port: number;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';
  last_check: string | null;
  uptime_seconds: number;
}

interface IncidentData {
  id: string;
  service_id: string;
  bug_type: string;
  severity: string;
  status: string;
  opened_at: string;
  resolved_at: string | null;
  root_cause: string | null;
  fix_summary: string | null;
  commit_sha: string | null;
  test_file: string | null;
}

function StatusDot({ status }: { status: string }) {
  if (status === 'HEALTHY') {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
    );
  }
  if (status === 'DEGRADED') {
    return <span className="relative flex h-2 w-2"><span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" /></span>;
  }
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const base = 'inline-block rounded px-2 py-0.5 text-xs font-semibold font-mono uppercase';
  if (status === 'HEALTHY') return <span className={`${base} bg-green-900 text-green-300`}>{status}</span>;
  if (status === 'DEGRADED') return <span className={`${base} bg-yellow-900 text-yellow-300`}>{status}</span>;
  if (status === 'CRITICAL') return <span className={`${base} bg-red-900 text-red-300`}>{status}</span>;
  return <span className={`${base} bg-gray-800 text-gray-400`}>{status}</span>;
}

function IncidentStatusBadge({ status }: { status: string }) {
  const base = 'inline-block rounded px-2 py-0.5 text-xs font-semibold font-mono uppercase';
  if (status === 'RESOLVED')     return <span className={`${base} bg-green-900 text-green-300`}>{status}</span>;
  if (status === 'OPEN')         return <span className={`${base} bg-red-900 text-red-300`}>{status}</span>;
  if (status === 'INVESTIGATING')return <span className={`${base} bg-orange-900 text-orange-300`}>{status}</span>;
  if (status === 'FIXING')       return <span className={`${base} bg-yellow-900 text-yellow-300`}>{status}</span>;
  if (status === 'TESTING')      return <span className={`${base} bg-blue-900 text-blue-300`}>{status}</span>;
  if (status === 'FAILED_FIX')   return <span className={`${base} bg-red-950 text-red-400`}>{status}</span>;
  return <span className={`${base} bg-gray-800 text-gray-400`}>{status}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const base = 'shrink-0 inline-block rounded px-2 py-0.5 text-xs font-semibold font-mono uppercase';
  if (severity === 'CRITICAL') return <span className={`${base} bg-red-900 text-red-300`}>{severity}</span>;
  if (severity === 'HIGH')     return <span className={`${base} bg-orange-900 text-orange-300`}>{severity}</span>;
  if (severity === 'MEDIUM')   return <span className={`${base} bg-yellow-900 text-yellow-300`}>{severity}</span>;
  return <span className={`${base} bg-gray-800 text-gray-400`}>{severity}</span>;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTime(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts + 'Z').toLocaleTimeString('en-US', { hour12: false });
}

export default function HomePage() {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [lastRefresh, setLastRefresh] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [svcRes, incRes] = await Promise.all([
      fetch('/api/services'),
      fetch('/api/incidents'),
    ]);
    const [svcData, incData] = await Promise.all([
      svcRes.json() as Promise<ServiceData[]>,
      incRes.json() as Promise<IncidentData[]>,
    ]);
    setServices(svcData);
    setIncidents(incData);
    setLastRefresh(new Date().toLocaleTimeString('en-US', { hour12: false }));
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
    const id = setInterval(() => void fetchAll(), 5_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const activeIncidents = incidents.filter(i => i.status !== 'RESOLVED');
  const resolvedIncidents = incidents.filter(i => i.status === 'RESOLVED');

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="animate-pulse text-gray-500">Loading sentinel data…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 space-y-16">

      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="mb-3 text-5xl font-bold tracking-tight">Project Sentinel</h1>
          <p className="text-xl text-gray-400">Autonomous incident resolution engine</p>
        </div>
        <p className="mt-2 font-mono text-xs text-gray-600">last refresh {lastRefresh}</p>
      </header>

      {/* System Health */}
      <section>
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-widest text-gray-500">
          System Health
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {services.map(svc => (
            <div
              key={svc.id}
              className="rounded-xl border border-gray-800 bg-gray-900 p-6 transition-colors hover:border-gray-700"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs text-gray-500">:{svc.port}</span>
                <StatusDot status={svc.status} />
              </div>
              <h3 className="text-lg font-semibold capitalize">{svc.id}</h3>
              <div className="mt-3">
                <StatusBadge status={svc.status} />
              </div>
              <p className="mt-2 font-mono text-xs text-gray-600">
                uptime {formatUptime(svc.uptime_seconds)}
              </p>
              {svc.last_check && (
                <p className="font-mono text-xs text-gray-700">
                  checked {formatTime(svc.last_check)}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Active Incidents */}
      <section>
        <h2 className="mb-6 flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-gray-500">
          Active Incidents
          {activeIncidents.length > 0 && (
            <span className="rounded-full bg-red-900 px-2 py-0.5 text-xs text-red-300 normal-case">
              {activeIncidents.length}
            </span>
          )}
        </h2>
        {activeIncidents.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-gray-500">No active incidents — all systems nominal</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeIncidents.map(inc => (
              <div
                key={inc.id}
                className="rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-200">{inc.id}</span>
                      <IncidentStatusBadge status={inc.status} />
                      <span className="inline-block rounded bg-gray-800 px-2 py-0.5 font-mono text-xs uppercase text-gray-400">
                        {inc.bug_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Service:{' '}
                      <span className="font-semibold capitalize text-gray-200">{inc.service_id}</span>
                      <span className="mx-2 text-gray-700">·</span>
                      Opened: <span className="font-mono">{formatTime(inc.opened_at)}</span>
                    </p>
                  </div>
                  <SeverityBadge severity={inc.severity} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resolved by Claude */}
      <section>
        <h2 className="mb-6 flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-gray-500">
          Resolved by Claude
          {resolvedIncidents.length > 0 && (
            <span className="rounded-full bg-green-900 px-2 py-0.5 text-xs text-green-300 normal-case">
              {resolvedIncidents.length}
            </span>
          )}
        </h2>
        {resolvedIncidents.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-gray-500">No resolved incidents yet — run the chaos monkey to start</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resolvedIncidents.map(inc => (
              <div
                key={inc.id}
                className="rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-gray-200">{inc.id}</span>
                  <IncidentStatusBadge status={inc.status} />
                  <span className="inline-block rounded bg-gray-800 px-2 py-0.5 font-mono text-xs uppercase text-gray-400">
                    {inc.bug_type}
                  </span>
                </div>
                <p className="mb-1 text-sm text-gray-400">
                  Service:{' '}
                  <span className="font-semibold capitalize text-gray-200">{inc.service_id}</span>
                  <span className="mx-2 text-gray-700">·</span>
                  Resolved: <span className="font-mono">{formatTime(inc.resolved_at)}</span>
                </p>
                {inc.root_cause && (
                  <p className="mt-2 text-xs text-gray-500">
                    <span className="text-gray-600">Root cause:</span> {inc.root_cause}
                  </p>
                )}
                {inc.fix_summary && (
                  <p className="text-xs text-gray-500">
                    <span className="text-gray-600">Fix:</span> {inc.fix_summary}
                  </p>
                )}
                {inc.commit_sha && (
                  <p className="mt-2 font-mono text-xs text-gray-600">
                    commit {inc.commit_sha.slice(0, 7)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}
