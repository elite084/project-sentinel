import Fastify from 'fastify';
import { createLogger } from '@sentinel/shared';
import type { HealthStatus } from '@sentinel/shared';

const SERVICE = 'inventory' as const;
const PORT = 4003;

const logger = createLogger(SERVICE);
const app = Fastify({ logger: false });
const startedAt = Date.now();

app.get('/health', async () => {
  const response: { status: HealthStatus; service: string; uptime: number } = {
    status: 'HEALTHY',
    service: SERVICE,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
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

    // Deterministic stock count derived from the item identifier
    const quantity = item.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 100;

    logger.info({ item, quantity }, 'inventory check');
    return { item, quantity, available: quantity > 0 };
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
