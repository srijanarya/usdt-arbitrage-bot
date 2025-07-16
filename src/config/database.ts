// READY FOR CURSOR: Press Cmd+K and say "Create PostgreSQL configuration with connection pooling and migrations"
import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const config: PoolConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
};

export const pool = new Pool(config);

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Connected to PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('QUERY:', text, params);
  }
  return pool.query(text, params);
};

export const withTransaction = async (fn: (client: any) => Promise<any>) => {
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
};
