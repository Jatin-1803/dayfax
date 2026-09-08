import { config as loadEnv } from 'dotenv';
import { closePool } from '../common/database/pool.js';
import { logger } from '../common/logger/logger.js';
import { UnpaidOrderReclaimService } from '../modules/orders/unpaid-order-reclaim.js';

loadEnv();

async function main(): Promise<void> {
  const service = new UnpaidOrderReclaimService();
  const result = await service.reclaimExpired();
  logger.info('Manual unpaid order reclaim complete', result);
  console.log(JSON.stringify({ success: true, ...result }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
