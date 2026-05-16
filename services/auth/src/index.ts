import Fastify from 'fastify';
import { createLogger } from '@sentinel/shared';
import type { HealthStatus } from '@sentinel/shared';

const SERVICE = 'auth' as const;
const PORT = 4001;

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

app.post<{ Body: { username: string; password: string } }>(
  '/auth/login',
  async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      reply.code(400);
      return { error: 'username and password are required' };
    }

    // Deterministic token: base64(username:timeBucket) — rotates every 5 minutes
    const bucket = Math.floor(Date.now() / 300_000);
    const token = Buffer.from(`${username}:${bucket}`).toString('base64url');

    logger.info({ username }, 'login');
    return { token, expiresIn: 300 };
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
