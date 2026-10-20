import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createPool, type Pool } from '../../src/shared/db';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../db/migrations');

export interface TestDatabase {
  pool: Pool;
  container: StartedPostgreSqlContainer;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

// Postgres จริงใน container ใหม่ รัน migration ทั้งหมดจากศูนย์
export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const pool = createPool(container.getConnectionUri());

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await pool.query(await readFile(join(MIGRATIONS_DIR, file), 'utf8'));
  }

  return {
    pool,
    container,
    reset: async () => {
      await pool.query('TRUNCATE voice_sessions, order_lines, orders, cart_lines, carts, queue_counters');
    },
    stop: async () => {
      await pool.end();
      await container.stop();
    },
  };
}
