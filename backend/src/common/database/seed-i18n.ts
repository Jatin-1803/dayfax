import { config as loadEnv } from 'dotenv';
import { closePool, getPool } from './pool.js';
import { UI_TRANSLATION_SEED } from './i18n-seed-data.js';

loadEnv();

async function seedI18n(): Promise<void> {
  const pool = getPool();

  await pool.query(
    `INSERT INTO ui_translations_meta (id, version)
     VALUES (1, 1)
     ON DUPLICATE KEY UPDATE id = id`,
  );

  for (const [key, values] of Object.entries(UI_TRANSLATION_SEED)) {
    await pool.query(
      `INSERT INTO ui_translations (string_key, en_value, hi_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         en_value = VALUES(en_value),
         hi_value = VALUES(hi_value)`,
      [key, values.en, values.hi],
    );
  }

  await pool.query(`UPDATE ui_translations_meta SET version = version + 1 WHERE id = 1`);

  console.log(`Seeded ${Object.keys(UI_TRANSLATION_SEED).length} UI translation keys`);
}

seedI18n()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await closePool();
    process.exit(1);
  });
