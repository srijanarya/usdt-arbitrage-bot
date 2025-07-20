import { Client } from 'pg';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

async function fixDatabaseSchema() {
  console.log(chalk.cyan('🔧 Fixing Database Schema...\n'));

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'arbitrage_bot',
    user: process.env.DB_USER || 'srijan',
    password: process.env.DB_PASSWORD || 'your_postgres_password'
  });

  try {
    await client.connect();
    console.log(chalk.green('✅ Connected to database\n'));

    // Drop existing tables if needed (be careful!)
    console.log(chalk.yellow('🗑️  Cleaning up old schema...'));
    
    // First, let's see what we have
    const existingTables = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position;
    `);
    
    console.log(chalk.gray('Current schema:'));
    let currentTable = '';
    existingTables.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(chalk.yellow(`\n${currentTable}:`));
      }
      console.log(chalk.gray(`  - ${row.column_name} (${row.data_type})`));
    });

    // Create our optimized schema
    console.log(chalk.yellow('\n📊 Creating optimized schema...'));

    // 1. Exchange configuration
    await client.query(`
      CREATE TABLE IF NOT EXISTS exchange_config (
        id SERIAL PRIMARY KEY,
        exchange_name VARCHAR(50) UNIQUE NOT NULL,
        api_enabled BOOLEAN DEFAULT true,
        fee_percentage DECIMAL(5,4) DEFAULT 0.001,
        min_order_size DECIMAL(15,8),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log(chalk.green('✅ Created exchange_config table'));

    // 2. Real-time price data
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_feed (
        id SERIAL PRIMARY KEY,
        exchange VARCHAR(50) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        bid_price DECIMAL(15,8) NOT NULL,
        ask_price DECIMAL(15,8) NOT NULL,
        bid_volume DECIMAL(15,8),
        ask_volume DECIMAL(15,8),
        timestamp TIMESTAMP DEFAULT NOW(),
        UNIQUE(exchange, symbol, timestamp)
      );
    `);
    console.log(chalk.green('✅ Created price_feed table'));

    // 3. Arbitrage opportunities
    await client.query(`
      CREATE TABLE IF NOT EXISTS arbitrage_alerts (
        id SERIAL PRIMARY KEY,
        opportunity_type VARCHAR(50) NOT NULL, -- 'simple', 'triangular', 'p2p'
        buy_exchange VARCHAR(50) NOT NULL,
        sell_exchange VARCHAR(50) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        buy_price DECIMAL(15,8) NOT NULL,
        sell_price DECIMAL(15,8) NOT NULL,
        quantity DECIMAL(15,8),
        gross_profit DECIMAL(15,8) NOT NULL,
        net_profit DECIMAL(15,8) NOT NULL,
        profit_percentage DECIMAL(8,4) NOT NULL,
        status VARCHAR(20) DEFAULT 'detected', -- 'detected', 'executing', 'completed', 'failed'
        detected_at TIMESTAMP DEFAULT NOW(),
        executed_at TIMESTAMP,
        notes TEXT
      );
    `);
    console.log(chalk.green('✅ Created arbitrage_alerts table'));

    // 4. Trade execution history
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        opportunity_id INTEGER REFERENCES arbitrage_alerts(id),
        exchange VARCHAR(50) NOT NULL,
        order_id VARCHAR(100),
        side VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
        symbol VARCHAR(20) NOT NULL,
        price DECIMAL(15,8) NOT NULL,
        quantity DECIMAL(15,8) NOT NULL,
        fee DECIMAL(15,8),
        total DECIMAL(15,8) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'filled', 'cancelled', 'failed'
        created_at TIMESTAMP DEFAULT NOW(),
        executed_at TIMESTAMP
      );
    `);
    console.log(chalk.green('✅ Created trades table'));

    // 5. P2P specific data
    await client.query(`
      CREATE TABLE IF NOT EXISTS p2p_orders (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) DEFAULT 'binance',
        order_id VARCHAR(100) UNIQUE,
        type VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
        payment_method VARCHAR(50),
        price DECIMAL(15,8) NOT NULL,
        quantity DECIMAL(15,8) NOT NULL,
        min_amount DECIMAL(15,8),
        max_amount DECIMAL(15,8),
        merchant_name VARCHAR(100),
        completion_rate DECIMAL(5,2),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log(chalk.green('✅ Created p2p_orders table'));

    // 6. Performance metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id SERIAL PRIMARY KEY,
        date DATE UNIQUE NOT NULL,
        total_volume DECIMAL(20,8) DEFAULT 0,
        total_trades INTEGER DEFAULT 0,
        successful_trades INTEGER DEFAULT 0,
        failed_trades INTEGER DEFAULT 0,
        gross_profit DECIMAL(15,8) DEFAULT 0,
        net_profit DECIMAL(15,8) DEFAULT 0,
        best_opportunity JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log(chalk.green('✅ Created daily_stats table'));

    // Create optimized indexes
    console.log(chalk.yellow('\n🚀 Creating performance indexes...'));
    
    await client.query(`
      -- Price feed indexes
      CREATE INDEX IF NOT EXISTS idx_price_feed_latest ON price_feed(exchange, symbol, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_price_feed_time ON price_feed(timestamp DESC);
      
      -- Arbitrage indexes
      CREATE INDEX IF NOT EXISTS idx_arbitrage_status ON arbitrage_alerts(status, detected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_arbitrage_profit ON arbitrage_alerts(profit_percentage DESC);
      
      -- Trade indexes
      CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_trades_opportunity ON trades(opportunity_id);
      
      -- P2P indexes
      CREATE INDEX IF NOT EXISTS idx_p2p_active ON p2p_orders(status, type, price);
    `);
    console.log(chalk.green('✅ Created all indexes'));

    // Add some initial exchange configurations
    console.log(chalk.yellow('\n📝 Adding initial exchange configurations...'));
    
    await client.query(`
      INSERT INTO exchange_config (exchange_name, fee_percentage, min_order_size)
      VALUES 
        ('binance', 0.001, 10),
        ('zebpay', 0.0025, 100),
        ('coindcx', 0.002, 100),
        ('kucoin', 0.001, 1),
        ('wazirx', 0.002, 100)
      ON CONFLICT (exchange_name) DO NOTHING;
    `);
    console.log(chalk.green('✅ Added exchange configurations'));

    console.log(chalk.bgGreen.black('\n 🎉 Database schema setup complete! \n'));
    
    // Show summary
    const tableCount = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    
    console.log(chalk.cyan('Summary:'));
    console.log(chalk.gray(`✓ Tables created: ${tableCount.rows[0].count}`));
    console.log(chalk.gray('✓ Indexes optimized for performance'));
    console.log(chalk.gray('✓ Exchange configurations loaded'));
    console.log(chalk.gray('✓ Ready for high-volume trading'));

  } catch (error) {
    console.error(chalk.red('❌ Error:', error.message));
  } finally {
    await client.end();
  }
}

// Run the fix
fixDatabaseSchema();