import pino, { type Logger } from 'pino';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

export type ServiceName = 'auth' | 'payments' | 'inventory';
export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type BugType =
  | 'SYNTAX_ERROR'
  | 'TYPE_MISMATCH'
  | 'LOGIC_ERROR'
  | 'RENAME_VAR'
  | 'DELETE_IMPORT';

export interface Service {
  name: ServiceName;
  port: number;
  url: string;
}

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  uptime: number;
}

export interface Incident {
  id: string;
  service: ServiceName;
  bugType: BugType;
  status: IncidentStatus;
  detectedAt: string;
  resolvedAt?: string;
  description: string;
}

export const SERVICE_REGISTRY: Record<ServiceName, Service> = {
  auth:      { name: 'auth',      port: 4001, url: 'http://localhost:4001' },
  payments:  { name: 'payments',  port: 4002, url: 'http://localhost:4002' },
  inventory: { name: 'inventory', port: 4003, url: 'http://localhost:4003' },
};

/**
 * Finds the monorepo's services/logs directory.
 *
 * Resolution order:
 *  1. SENTINEL_LOGS_DIR env var (explicit override)
 *  2. Walk up from process.cwd() until a directory containing services/logs is found
 *  3. Fallback: resolve from this file's location (packages/shared/src → repo root)
 */
function resolveLogsDir(): string {
  if (process.env['SENTINEL_LOGS_DIR']) {
    return process.env['SENTINEL_LOGS_DIR'];
  }

  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'services', 'logs');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached fs root
    dir = parent;
  }

  // This file lives at packages/shared/src/index.ts — three levels up is the repo root.
  const here = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(here), '..', '..', '..', 'services', 'logs');
}

/**
 * Creates a pino logger that fans out to:
 *  - stdout via pino-pretty (colorized, human-readable)
 *  - services/logs/<serviceName>.log (JSON, async)
 */
export function createLogger(serviceName: ServiceName): Logger {
  const logsDir = resolveLogsDir();
  const dest = path.join(logsDir, `${serviceName}.log`);

  const transport = pino.transport({
    targets: [
      {
        target: 'pino-pretty',
        level: 'info',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
      {
        target: 'pino/file',
        level: 'info',
        options: { destination: dest, mkdir: true },
      },
    ],
  });

  return pino({ name: serviceName, level: 'info' }, transport);
}
