import Database from 'better-sqlite3';
import pino from 'pino';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_REGISTRY, type ServiceName } from '@sentinel/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(REPO_ROOT, 'sentinel.db');
const HISTORY_LOG = path.join(REPO_ROOT, 'docs', 'incident-history.log');
const INTERVAL_MS = 5_000;

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
  },
});

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const stmtUpdateHealthy = db.prepare(
  `UPDATE services SET status = ?, last_check = CURRENT_TIMESTAMP, uptime_seconds = ? WHERE id = ?`,
);
const stmtUpdateCritical = db.prepare(
  `UPDATE services SET status = 'CRITICAL', last_check = CURRENT_TIMESTAMP WHERE id = ?`,
);
const stmtGetOpenIncident = db.prepare(
  `SELECT id FROM incidents WHERE service_id = ? AND status = 'OPEN' LIMIT 1`,
);
const stmtInsertIncident = db.prepare(
  `INSERT INTO incidents (id, service_id, bug_type, severity, status, opened_at)
   VALUES (?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP)`,
);
const stmtInsertResolution = db.prepare(
  `INSERT INTO resolutions (incident_id, agent, action, detail, timestamp)
   VALUES (?, 'poller', ?, ?, CURRENT_TIMESTAMP)`,
);

type DbStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

interface HistoryEntry {
  incidentId: string;
  service: string;
  bugType: string;
  status: string;
  timestamp: string;
}

interface OpenRow {
  id: string;
}

const prevStatus = new Map<ServiceName, DbStatus>();

function generateIncidentId(): string {
  const ts = Math.floor(Date.now() / 1000);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${ts}-${rand}`;
}

function detectBugType(serviceName: ServiceName): string {
  try {
    const lines = readFileSync(HISTORY_LOG, 'utf-8').trim().split('\n').filter(Boolean);
    const injected = new Map<string, HistoryEntry>();
    const reset = new Set<string>();

    for (const line of lines) {
      const entry = JSON.parse(line) as HistoryEntry;
      if (entry.service !== serviceName) continue;
      if (entry.status === 'INJECTED') injected.set(entry.incidentId, entry);
      else if (entry.status === 'RESET') reset.add(entry.incidentId);
    }

    let best: HistoryEntry | null = null;
    for (const [id, entry] of injected) {
      if (!reset.has(id) && (!best || entry.timestamp > best.timestamp)) best = entry;
    }
    return best?.bugType ?? 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

function statusColor(s: DbStatus): string {
  if (s === 'HEALTHY') return '\x1b[32m';
  if (s === 'DEGRADED') return '\x1b[33m';
  return '\x1b[31m';
}

async function pollOnce(): Promise<void> {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const parts: string[] = [];

  for (const [name, service] of Object.entries(SERVICE_REGISTRY) as [ServiceName, (typeof SERVICE_REGISTRY)[ServiceName]][]) {
    try {
      const res = await fetch(`${service.url}/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as { status: DbStatus; uptime: number };
      const newStatus: DbStatus = data.status;
      stmtUpdateHealthy.run(newStatus, data.uptime, name);

      const old = prevStatus.get(name);
      if (old === 'CRITICAL' && newStatus === 'HEALTHY') {
        const row = stmtGetOpenIncident.get(name) as OpenRow | undefined;
        if (row) {
          stmtInsertResolution.run(row.id, 'recovered_externally', `${name} returned HEALTHY — not auto-resolved`);
          logger.info({ service: name, incident: row.id }, 'Service recovered externally; incident left OPEN for agent');
        }
      }

      prevStatus.set(name, newStatus);
      parts.push(`${statusColor(newStatus)}${newStatus}\x1b[0m ${name}(${service.port})`);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      stmtUpdateCritical.run(name);

      const old = prevStatus.get(name);
      const isNewOutage = old === 'HEALTHY' || old === 'UNKNOWN' || old === undefined;

      if (isNewOutage) {
        const existing = stmtGetOpenIncident.get(name) as OpenRow | undefined;
        if (!existing) {
          const incidentId = generateIncidentId();
          const bugType = detectBugType(name);
          stmtInsertIncident.run(incidentId, name, bugType, 'CRITICAL');
          stmtInsertResolution.run(incidentId, 'detected', `${name} went CRITICAL: ${reason}`);
          logger.error({ service: name, incident: incidentId, bugType, reason }, 'Incident opened');
          parts.push(
            `\x1b[31mCRITICAL\x1b[0m ${name}(${service.port}) ← reason: ${reason} | incident ${incidentId} opened`,
          );
        } else {
          parts.push(
            `\x1b[31mCRITICAL\x1b[0m ${name}(${service.port}) ← ${reason} | incident ${existing.id} already open`,
          );
        }
      } else {
        parts.push(`\x1b[31mCRITICAL\x1b[0m ${name}(${service.port}) ← ${reason}`);
      }

      prevStatus.set(name, 'CRITICAL');
    }
  }

  process.stdout.write(`[${time}] ${parts.join('  ')}\n`);
}

function shutdown(): void {
  logger.info('Poller shutting down');
  db.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info('Sentinel poller started — polling every 5s');
void pollOnce();
setInterval(() => void pollOnce(), INTERVAL_MS);
