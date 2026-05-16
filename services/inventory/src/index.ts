import Fastify from 'fastify';
import { createLogger } from '@sentinel/shared';
import type { HealthStatus } from '@sentinel/shared';

const SERVICE = 'inventory' as const;
const PORT = 4003;

const logger = createLogger(SERVICE);
const app = Fastify({ logger: false });
const startedAt = Date.now();

interface CheckResult {
  item: string;
  quantity: number;
  available: boolean;
}

// Core inventory logic shared by the route handler and the health self-test.
function computeCheck(item: string): CheckResult {
  const quantity = item.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 100;
  return { item, quantity, available: quantity > 0 };
}

app.get('/health', async (_, reply) => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  try {
    // '__healthcheck__' has char-sum 1520, so quantity=20, available=true
    const probe = computeCheck('__healthcheck__');
    if (typeof probe.quantity !== 'number' || probe.available !== true) {
      throw new Error('shape mismatch');
    }
  } catch (err) {
    void reply.code(503);
    return {
      status: 'CRITICAL' as HealthStatus,
      service: SERVICE,
      uptime,
      reason: err instanceof Error ? err.message : 'unknown',
    };
  }
  const response: { status: HealthStatus; service: string; uptime: number } = {
    status: 'HEALTHY',
    service: SERVICE,
    uptime,
  };
  logger.info(response, 'health check');
  return response;
});

app.get<{ Querystring: { item?: string } }>(
  '/inventory/check',
  async (request, reply) => {
    const item = request.query.item;

    if (!item) {
      reply.code(400);
      return { error: 'item query parameter is required' };
    }

    const result = computeCheck(item);
    logger.info({ item, quantity: result.quantity }, 'inventory check');
    return result;
  },
);

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use — is another ${SERVICE} instance running?`);
    } else {
      logger.error(err, 'failed to start');
    }
    process.exit(1);
  }
  logger.info(`✓ ${SERVICE} listening on http://localhost:${PORT}`);
});
