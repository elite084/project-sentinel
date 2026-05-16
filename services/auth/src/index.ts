import Fastify from 'fastify';
import { createLogger } from '@sentinel/shared';
import type { HealthStatus } from '@sentinel/shared';

const SERVICE = 'auth' as const;
const PORT = 4001;

const logger = createLogger(SERVICE);
const app = Fastify({ logger: false });
const startedAt = Date.now();

interface LoginResult {
  token: string;
  expiresIn: number;
}

// Core login logic shared by the route handler and the health self-test.
function computeLogin(username: string): LoginResult {
  const bucket = Math.floor(Date.now() / 300_000);
  const token = Buffer.from(`${username}:${bucket}`).toString('base64url');
  return { token, expiresIn: 300 };
}

app.get('/health', async (_, reply) => {
  const uptime = Math.floor((Date.now() - startedAt) / 1000);
  try {
    const probe = computeLogin('__healthcheck__');
    const decoded = Buffer.from(probe.token, 'base64url').toString('utf-8');
    if (!decoded.startsWith('__healthcheck__:') || typeof probe.expiresIn !== 'number') {
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

app.post<{ Body: { username: string; password: string } }>(
  '/auth/login',
  async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      reply.code(400);
      return { error: 'username and password are required' };
    }

    const result = computeLogin(username);
    logger.info({ username }, 'login');
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
