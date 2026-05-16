import { SERVICE_REGISTRY } from '@sentinel/shared';
import type { HealthResponse } from '@sentinel/shared';

const INTERVAL_MS = 5_000;

async function pollOnce(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}]`);

  for (const [name, service] of Object.entries(SERVICE_REGISTRY)) {
    try {
      const res = await fetch(`${service.url}/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      const data = (await res.json()) as HealthResponse;
      const statusColor =
        data.status === 'HEALTHY'  ? '\x1b[32m' :
        data.status === 'DEGRADED' ? '\x1b[33m' :
                                     '\x1b[31m';
      console.log(
        `  ${name.padEnd(12)} ${statusColor}${data.status}\x1b[0m  uptime=${data.uptime}s`,
      );
    } catch {
      console.log(`  ${name.padEnd(12)} \x1b[31mUNREACHABLE\x1b[0m`);
    }
  }
}

console.log('Sentinel poller started — polling every 5s (Ctrl+C to stop)');
void pollOnce();
setInterval(() => void pollOnce(), INTERVAL_MS);
