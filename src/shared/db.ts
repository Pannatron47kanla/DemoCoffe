import pg from 'pg';

// คอลัมน์ date (OID 1082) อ่านเป็น 'YYYY-MM-DD' ไม่แปลงเป็น Date ตาม timezone ของเครื่อง
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export type Pool = pg.Pool;
export type DbClient = pg.PoolClient;

export function createPool(connectionString: string): Pool {
  return new pg.Pool({ connectionString });
}

export async function inTransaction<T>(pool: Pool, work: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const e = error as { code?: string; constraint?: string };
  return e?.code === '23505' && e.constraint === constraint;
}
