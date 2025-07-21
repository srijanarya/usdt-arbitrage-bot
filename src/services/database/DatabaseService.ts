import { Pool, PoolClient } from 'pg';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

interface PriceData {
  exchange: string;
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  volume?: number;
  timestamp: Date;
}

interface ArbitrageOpportunity {
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPercent: number;
  volume: number;
  timestamp: Date;
}

interface Trade {
  opportunityId?: number;
  type: 'buy' | 'sell';
  exchange: string;
  price: number;
  amount: number;
  fees: number;
  status: 'pending' | 'completed' | 'failed';
  executedAt?: Date;
}

export class DatabaseService {
  private pool: Pool;
  private batchInsertTimer?: NodeJS.Timeout;
  private priceBatch: PriceData[] = [];
  private batchSize = 100;
  private batchInterval = 5000; // 5 seconds

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'arbitrage_bot',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error(chalk.red('Unexpected database error:'), err);
    });

    this.initializeBatchInsert();
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      console.log(chalk.green('✅ Database connected successfully'));
      console.log(chalk.gray(`Server time: ${result.rows[0].now}`));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Database connection failed:'), error);
      return false;
    }
  }

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create exchanges table
      await client.query(`
        CREATE TABLE IF NOT EXISTS exchanges (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) UNIQUE NOT NULL,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create price_history table with indexes
      await client.query(`
        CREATE TABLE IF NOT EXISTS price_history (
          id SERIAL PRIMARY KEY,
          exchange_id INTEGER REFERENCES exchanges(id),
          symbol VARCHAR(20) NOT NULL,
          buy_price DECIMAL(10, 2) NOT NULL,
          sell_price DECIMAL(10, 2) NOT NULL,
          volume DECIMAL(20, 2),
          timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_price_history_timestamp 
        ON price_history(timestamp DESC)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_price_history_exchange_timestamp 
        ON price_history(exchange_id, timestamp DESC)
      `);

      // Create arbitrage_opportunities table
      await client.query(`
        CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
          id SERIAL PRIMARY KEY,
          buy_exchange_id INTEGER REFERENCES exchanges(id),
          sell_exchange_id INTEGER REFERENCES exchanges(id),
          buy_price DECIMAL(10, 2) NOT NULL,
          sell_price DECIMAL(10, 2) NOT NULL,
          profit DECIMAL(10, 2) NOT NULL,
          profit_percent DECIMAL(5, 2) NOT NULL,
          volume DECIMAL(20, 2) NOT NULL,
          detected_at TIMESTAMP NOT NULL,
          acted_upon BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create trades table
      await client.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id SERIAL PRIMARY KEY,
          opportunity_id INTEGER REFERENCES arbitrage_opportunities(id),
          type VARCHAR(10) NOT NULL,
          exchange_id INTEGER REFERENCES exchanges(id),
          price DECIMAL(10, 2) NOT NULL,
          amount DECIMAL(20, 8) NOT NULL,
          fees DECIMAL(10, 2) NOT NULL,
          status VARCHAR(20) NOT NULL,
          executed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create performance metrics view
      await client.query(`
        CREATE OR REPLACE VIEW daily_performance AS
        SELECT 
          DATE(detected_at) as date,
          COUNT(*) as opportunities_count,
          SUM(CASE WHEN acted_upon THEN 1 ELSE 0 END) as acted_count,
          AVG(profit_percent) as avg_profit_percent,
          MAX(profit_percent) as max_profit_percent,
          SUM(profit) as total_potential_profit
        FROM arbitrage_opportunities
        GROUP BY DATE(detected_at)
        ORDER BY date DESC
      `);

      // Insert default exchanges
      await client.query(`
        INSERT INTO exchanges (name) VALUES 
        ('zebpay'), 
        ('coindcx'), 
        ('wazirx'), 
        ('coinswitch')
        ON CONFLICT (name) DO NOTHING
      `);

      await client.query('COMMIT');
      console.log(chalk.green('✅ Database schema initialized'));
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(chalk.red('Schema initialization failed:'), error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Insert price data (with batching)
   */
  async insertPrice(priceData: PriceData): Promise<void> {
    this.priceBatch.push(priceData);
    
    if (this.priceBatch.length >= this.batchSize) {
      await this.flushPriceBatch();
    }
  }

  /**
   * Initialize batch insert timer
   */
  private initializeBatchInsert(): void {
    this.batchInsertTimer = setInterval(() => {
      if (this.priceBatch.length > 0) {
        this.flushPriceBatch();
      }
    }, this.batchInterval);
  }

  /**
   * Flush price batch to database
   */
  private async flushPriceBatch(): Promise<void> {
    if (this.priceBatch.length === 0) return;

    const batch = [...this.priceBatch];
    this.priceBatch = [];

    const client = await this.pool.connect();
    try {
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      for (const price of batch) {
        // Get exchange ID
        const exchangeResult = await client.query(
          'SELECT id FROM exchanges WHERE name = $1',
          [price.exchange]
        );
        
        if (exchangeResult.rows.length > 0) {
          const exchangeId = exchangeResult.rows[0].id;
          placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
          values.push(exchangeId, price.symbol, price.buyPrice, price.sellPrice, price.volume || null, price.timestamp);
          paramIndex += 6;
        }
      }

      if (placeholders.length > 0) {
        const query = `
          INSERT INTO price_history (exchange_id, symbol, buy_price, sell_price, volume, timestamp)
          VALUES ${placeholders.join(', ')}
        `;
        
        await client.query(query, values);
        console.log(chalk.gray(`Inserted ${placeholders.length} price records`));
      }
    } catch (error) {
      console.error(chalk.red('Batch insert failed:'), error);
    } finally {
      client.release();
    }
  }

  /**
   * Save arbitrage opportunity
   */
  async saveArbitrageOpportunity(opportunity: ArbitrageOpportunity): Promise<number> {
    const client = await this.pool.connect();
    try {
      // Get exchange IDs
      const buyExchangeResult = await client.query(
        'SELECT id FROM exchanges WHERE name = $1',
        [opportunity.buyExchange]
      );
      const sellExchangeResult = await client.query(
        'SELECT id FROM exchanges WHERE name = $1',
        [opportunity.sellExchange]
      );

      if (buyExchangeResult.rows.length === 0 || sellExchangeResult.rows.length === 0) {
        throw new Error('Exchange not found');
      }

      const result = await client.query(
        `INSERT INTO arbitrage_opportunities 
         (buy_exchange_id, sell_exchange_id, buy_price, sell_price, profit, profit_percent, volume, detected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          buyExchangeResult.rows[0].id,
          sellExchangeResult.rows[0].id,
          opportunity.buyPrice,
          opportunity.sellPrice,
          opportunity.profit,
          opportunity.profitPercent,
          opportunity.volume,
          opportunity.timestamp
        ]
      );

      console.log(chalk.green(`💾 Saved arbitrage opportunity #${result.rows[0].id}`));
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Get recent arbitrage opportunities
   */
  async getRecentOpportunities(limit: number = 10): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT 
        ao.*,
        be.name as buy_exchange,
        se.name as sell_exchange
       FROM arbitrage_opportunities ao
       JOIN exchanges be ON ao.buy_exchange_id = be.id
       JOIN exchanges se ON ao.sell_exchange_id = se.id
       ORDER BY ao.detected_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Get daily performance metrics
   */
  async getDailyPerformance(days: number = 7): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM daily_performance LIMIT $1',
      [days]
    );
    return result.rows;
  }

  /**
   * Get latest prices for all exchanges
   */
  async getLatestPrices(): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT DISTINCT ON (e.name) 
        e.name as exchange,
        ph.buy_price,
        ph.sell_price,
        ph.volume,
        ph.timestamp
      FROM price_history ph
      JOIN exchanges e ON ph.exchange_id = e.id
      WHERE ph.timestamp > NOW() - INTERVAL '1 minute'
      ORDER BY e.name, ph.timestamp DESC
    `);
    return result.rows;
  }

  /**
   * Mark opportunity as acted upon
   */
  async markOpportunityActed(opportunityId: number): Promise<void> {
    await this.pool.query(
      'UPDATE arbitrage_opportunities SET acted_upon = true WHERE id = $1',
      [opportunityId]
    );
  }

  /**
   * Save trade record
   */
  async saveTrade(trade: Trade & { exchangeName: string }): Promise<number> {
    const client = await this.pool.connect();
    try {
      const exchangeResult = await client.query(
        'SELECT id FROM exchanges WHERE name = $1',
        [trade.exchangeName]
      );

      if (exchangeResult.rows.length === 0) {
        throw new Error('Exchange not found');
      }

      const result = await client.query(
        `INSERT INTO trades 
         (opportunity_id, type, exchange_id, price, amount, fees, status, executed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          trade.opportunityId || null,
          trade.type,
          exchangeResult.rows[0].id,
          trade.price,
          trade.amount,
          trade.fees,
          trade.status,
          trade.executedAt || null
        ]
      );

      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Get exchange statistics
   */
  async getExchangeStats(hours: number = 24): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT 
        e.name as exchange,
        COUNT(ph.id) as price_updates,
        AVG(ph.sell_price - ph.buy_price) as avg_spread,
        MAX(ph.sell_price - ph.buy_price) as max_spread,
        MIN(ph.timestamp) as first_update,
        MAX(ph.timestamp) as last_update
      FROM exchanges e
      LEFT JOIN price_history ph ON e.id = ph.exchange_id
      WHERE ph.timestamp > NOW() - INTERVAL '%s hours'
      GROUP BY e.id, e.name
      ORDER BY e.name`,
      [hours]
    );
    return result.rows;
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM price_history WHERE timestamp < NOW() - INTERVAL \'%s days\' RETURNING id',
      [daysToKeep]
    );
    console.log(chalk.yellow(`Cleaned up ${result.rowCount} old price records`));
  }

  /**
   * Execute raw query
   */
  async executeQuery(query: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(query, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.batchInsertTimer) {
      clearInterval(this.batchInsertTimer);
    }
    await this.flushPriceBatch();
    await this.pool.end();
    console.log(chalk.yellow('Database connection closed'));
  }
}

// Create singleton instance
export const databaseService = new DatabaseService();