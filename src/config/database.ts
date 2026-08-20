import { Pool, QueryResult, QueryResultRow } from 'pg';

// Railway injeta DATABASE_URL automaticamente ao linkar o plugin PostgreSQL.
// SSL é necessário em produção no Railway (não em localhost).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err: Error) => {
  // Erros em clientes ociosos no pool não devem derrubar o processo
  console.error('[db] erro inesperado no pool de conexões', err);
});

/**
 * Helper central de query — SEMPRE parametrizada ($1, $2, ...).
 * Nunca faça interpolação de strings ao montar SQL.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Executa uma função dentro de uma transação, com rollback automático em erro.
 * Uso: await withTransaction(async (client) => { ... });
 */
export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
