import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config as loadEnv } from 'dotenv';

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureDatabase(): Promise<void> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    multipleStatements: true,
  });

  const dbName = process.env.DB_NAME ?? 'dailyfax';
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.end();
}

async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'dailyfax',
    multipleStatements: true,
  });
}

async function migrateUp(): Promise<void> {
  await ensureDatabase();
  const connection = await getConnection();

  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const [appliedRows] = await connection.query<mysql.RowDataPacket[]>(
    'SELECT name FROM schema_migrations',
  );
  const applied = new Set(appliedRows.map((row) => row.name as string));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`apply ${file}`);
    await connection.query(sql);
    await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
  }

  await connection.end();
  console.log('Migrations complete');
}

async function migrateDown(): Promise<void> {
  console.error('Down migrations are not implemented for safety. Restore from backup or drop DB in local only.');
  process.exit(1);
}

const direction = process.argv[2] === 'down' ? 'down' : 'up';

if (direction === 'down') {
  await migrateDown();
} else {
  await migrateUp();
}
