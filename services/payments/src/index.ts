import Fastify from 'fastify';
import { createLogger } from '@sentinel/shared';
import type { HealthStatus } from '@sentinel/shared';

const SERVICE = 'payments' as const;
const PORT = 4002;

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

app.post<{ Body: { amount: number; currency: string } }>(
  '/payments/charge',
  async (request, reply) => {
    const { amount, currency } = request.body;

    if (typeof amount !== 'number' || amount <= 0) {
      reply.code(400);
      return { error: 'amount must be a positive number' };
    }

    if (!currency) {
      reply.code(400);
      return { error: 'currency is required' };
    }

    // Deterministic transaction ID based on amount + currency + time bucket
    const bucket = Math.floor(Date.now() / 1000);
    const raw = `${amount.toFixed(2)}-${currency.toUpperCase()}-${bucket}`;
    const transactionId = `txn_${Buffer.from(raw).toString('base64url').slice(0, 16)}`;

    logger.info({ amount, currency, transactionId }, 'charge');
    return { transactionId, status: 'approved', amount, currency: currency.toUpperCase() };
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
