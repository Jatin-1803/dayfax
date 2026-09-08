import { config as loadEnv } from 'dotenv';
import { closePool } from '../common/database/pool.js';
import { SearchIndexService } from '../modules/search/search-index.service.js';

loadEnv();

async function main(): Promise<void> {
  const service = new SearchIndexService();
  if (!service.enabled) {
    console.error('Meilisearch is not configured. Set MEILI_HOST (and MEILI_MASTER_KEY).');
    process.exit(1);
  }

  const result = await service.reindexAll();
  console.log('Reindex complete', result);
  await closePool();
}

main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
