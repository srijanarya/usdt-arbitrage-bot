import { Client } from 'pg';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log(chalk.cyan('🔍 Testing PostgreSQL Connection...\n'));

  // Create client with connection details
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'arbitrage_bot',
    user: process.env.DB_USER || 'srijan',
    password: process.env.DB_PASSWORD || 'your_postgres_password'
  });

  try {
    // Connect to database
    console.log(chalk.yellow('📡 Connecting to PostgreSQL...'));
    await client.connect();
    console.log(chalk.green('✅ Connected successfully!\n'));

    // Test query
    console.log(chalk.yellow('🔍 Running test query...'));
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(chalk.green('✅ Query successful!'));
    console.log(chalk.gray(`Current time: ${result.rows[0].current_time}`));
    console.log(chalk.gray(`PostgreSQL version: ${result.rows[0].pg_version}\n`));

    // Check if tables exist
    console.log(chalk.yellow('📊 Checking existing tables...'));
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length > 0) {
      console.log(chalk.green(`✅ Found ${tablesResult.rows.length} tables:`));
      tablesResult.rows.forEach(row => {
        console.log(chalk.gray(`   - ${row.table_name}`));
      });
    } else {
      console.log(chalk.yellow('⚠️  No tables found. Database is empty.'));
    }

    // Create tables if they don't exist
    console.log(chalk.yellow('\n🔨 Creating/Updating database schema...'));
    
    // Price monitoring table
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_data (
        id SERIAL PRIMARY KEY,
        exchange VARCHAR(50) NOT NULL,
        pair VARCHAR(20) NOT NULL,
        bid DECIMAL(15,8) NOT NULL,
        ask DECIMAL(15,8) NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log(chalk.green('✅ Created price_data table'));

    // Arbitrage opportunities table
    await client.query(`
      CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
        id SERIAL PRIMARY KEY,
        buy_exchange VARCHAR(50) NOT NULL,
        sell_exchange VARCHAR(50) NOT NULL,
        buy_price DECIMAL(15,8) NOT NULL,
        sell_price DECIMAL(15,8) NOT NULL,
        profit_percentage DECIMAL(8,4) NOT NULL,
        profit_amount DECIMAL(15,8) NOT NULL,
        detected_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log(chalk.green('✅ Created arbitrage_opportunities table'));

    // Trade history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trade_history (
        id SERIAL PRIMARY KEY,
        exchange VARCHAR(50) NOT NULL,
        side VARCHAR(10) NOT NULL,
        pair VARCHAR(20) NOT NULL,
        price DECIMAL(15,8) NOT NULL,
        amount DECIMAL(15,8) NOT NULL,
        total DECIMAL(15,8) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        executed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log(chalk.green('✅ Created trade_history table'));

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_price_data_timestamp ON price_data(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_arbitrage_detected ON arbitrage_opportunities(detected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_trade_history_executed ON trade_history(executed_at DESC);
    `);
    console.log(chalk.green('✅ Created indexes for performance\n'));

    console.log(chalk.bgGreen.black(' 🎉 PostgreSQL setup complete! '));
    console.log(chalk.cyan('\nConnection details:'));
    console.log(chalk.gray(`Host: ${process.env.DB_HOST}`));
    console.log(chalk.gray(`Port: ${process.env.DB_PORT}`));
    console.log(chalk.gray(`Database: ${process.env.DB_NAME}`));
    console.log(chalk.gray(`User: ${process.env.DB_USER}`));

  } catch (error) {
    console.error(chalk.red('❌ Connection failed!'));
    console.error(chalk.red(`Error: ${error.message}`));
    
    // Provide helpful error messages
    if (error.message.includes('password authentication failed')) {
      console.log(chalk.yellow('\n💡 Fix: Update DB_PASSWORD in .env file'));
      console.log(chalk.yellow('   Run: psql -U srijan -d postgres'));
      console.log(chalk.yellow('   Then: ALTER USER srijan PASSWORD \'your_new_password\';'));
    } else if (error.message.includes('database "arbitrage_bot" does not exist')) {
      console.log(chalk.yellow('\n💡 Fix: Create the database'));
      console.log(chalk.yellow('   Run: createdb -U srijan arbitrage_bot'));
    }
  } finally {
    await client.end();
  }
}

// Run the test
testConnection();