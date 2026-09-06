import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './common/database/pool.js';
import { logger } from './common/logger/logger.js';
import {
  startUnpaidOrderReclaimScheduler,
  stopUnpaidOrderReclaimScheduler,
} from './modules/orders/unpaid-order-reclaim.js';

const app = createApp();

const host = process.env.HOST ?? '0.0.0.0';

const server = app.listen(env.PORT, host, () => {
  logger.info(`DayFax API listening on ${host}:${env.PORT}`, {
    env: env.NODE_ENV,
    prefix: env.API_PREFIX,
  });
  startUnpaidOrderReclaimScheduler();
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Shutting down (${signal})`);
  stopUnpaidOrderReclaimScheduler();
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
