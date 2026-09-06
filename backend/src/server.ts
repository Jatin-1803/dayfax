import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './common/database/pool.js';
import { logger } from './common/logger/logger.js';

const app = createApp();

const host = process.env.HOST ?? '0.0.0.0';

const server = app.listen(env.PORT, host, () => {
  logger.info(`Dailyfax API listening on ${host}:${env.PORT}`, {
    env: env.NODE_ENV,
    prefix: env.API_PREFIX,
  });
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Shutting down (${signal})`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
