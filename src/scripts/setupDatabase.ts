import { pool } from '../config/database';

const createTables = async () => {
  const client = await pool.connect();
  try {
    // Exchanges Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS exchanges (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Price History Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        exchange_id INT REFERENCES exchanges(id) ON DELETE CASCADE,
        symbol VARCHAR(50) NOT NULL,
        bid NUMERIC,
        ask NUMERIC,
        volume NUMERIC,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol);
    `);

    // Arbitrage Opportunities Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
        id SERIAL PRIMARY KEY,
        buy_exchange_id INT REFERENCES exchanges(id),
        sell_exchange_id INT REFERENCES exchanges(id),
        symbol VARCHAR(50) NOT NULL,
        buy_price NUMERIC NOT NULL,
        sell_price NUMERIC NOT NULL,
        profit NUMERIC NOT NULL,
        profit_percentage NUMERIC NOT NULL,
        status VARCHAR(50) DEFAULT 'detected', -- detected, executed, completed, failed
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_status ON arbitrage_opportunities(status);
    `);

    // Trades Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        opportunity_id INT REFERENCES arbitrage_opportunities(id),
        exchange_id INT REFERENCES exchanges(id),
        side VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
        symbol VARCHAR(50) NOT NULL,
        price NUMERIC NOT NULL,
        quantity NUMERIC NOT NULL,
        fees NUMERIC,
        status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
        order_id VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Database tables created successfully!');
  } catch (err) {
    console.error('Error creating database tables:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

createTables();
