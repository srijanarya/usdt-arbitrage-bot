import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function testDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('🔄 Testing PostgreSQL connection...');
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL!');
    
    // Test query
    const result = await client.query('SELECT NOW()');
    console.log('✅ Current time from DB:', result.rows[0].now);
    
    // Check if tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\n📊 Database tables:');
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Test exchanges table
    const exchanges = await client.query('SELECT * FROM exchanges');
    console.log('\n🏦 Exchanges in database:');
    exchanges.rows.forEach(row => {
      console.log(`   - ${row.name} (ID: ${row.id})`);
    });
    
    client.release();
    console.log('\n✅ Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error instanceof Error ? error.message : error);
    console.log('\n💡 Make sure:');
    console.log('   1. PostgreSQL is running');
    console.log('   2. Database "arbitrage_bot" exists');
    console.log('   3. Your .env file has correct DB_PASSWORD');
  } finally {
    await pool.end();
  }
}

testDatabase();