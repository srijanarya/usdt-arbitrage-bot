import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a connection pool for better performance
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'arbitrage_bot',
  user: process.env.DB_USER || 'srijan',
  password: process.env.DB_PASSWORD || 'your_postgres_password',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export class PostgresService {
  // Save price data
  static async savePriceData(exchange: string, symbol: string, bid: number, ask: number) {
    try {
      const query = `
        INSERT INTO price_feed (exchange, symbol, bid_price, ask_price)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `;
      const result = await pool.query(query, [exchange, symbol, bid, ask]);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving price data:', error);
      throw error;
    }
  }

  // Save arbitrage opportunity
  static async saveArbitrageOpportunity(data: {
    type: string;
    buyExchange: string;
    sellExchange: string;
    symbol: string;
    buyPrice: number;
    sellPrice: number;
    grossProfit: number;
    netProfit: number;
    profitPercentage: number;
  }) {
    try {
      const query = `
        INSERT INTO arbitrage_alerts (
          opportunity_type, buy_exchange, sell_exchange, symbol,
          buy_price, sell_price, gross_profit, net_profit, profit_percentage
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id;
      `;
      const values = [
        data.type,
        data.buyExchange,
        data.sellExchange,
        data.symbol,
        data.buyPrice,
        data.sellPrice,
        data.grossProfit,
        data.netProfit,
        data.profitPercentage
      ];
      const result = await pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving arbitrage opportunity:', error);
      throw error;
    }
  }

  // Save trade execution
  static async saveTrade(data: {
    opportunityId?: number;
    exchange: string;
    orderId?: string;
    side: string;
    symbol: string;
    price: number;
    quantity: number;
    fee: number;
    total: number;
    status: string;
  }) {
    try {
      const query = `
        INSERT INTO trades (
          opportunity_id, exchange, order_id, side, symbol,
          price, quantity, fee, total, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id;
      `;
      const values = [
        data.opportunityId,
        data.exchange,
        data.orderId,
        data.side,
        data.symbol,
        data.price,
        data.quantity,
        data.fee,
        data.total,
        data.status
      ];
      const result = await pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving trade:', error);
      throw error;
    }
  }

  // Save P2P order
  static async saveP2POrder(data: {
    platform: string;
    orderId: string;
    type: string;
    paymentMethod: string;
    price: number;
    quantity: number;
    minAmount: number;
    maxAmount: number;
    merchantName: string;
    completionRate: number;
  }) {
    try {
      const query = `
        INSERT INTO p2p_orders (
          platform, order_id, type, payment_method, price,
          quantity, min_amount, max_amount, merchant_name, completion_rate
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (order_id) DO UPDATE
        SET price = $5, quantity = $6, updated_at = NOW()
        RETURNING id;
      `;
      const values = [
        data.platform,
        data.orderId,
        data.type,
        data.paymentMethod,
        data.price,
        data.quantity,
        data.minAmount,
        data.maxAmount,
        data.merchantName,
        data.completionRate
      ];
      const result = await pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving P2P order:', error);
      throw error;
    }
  }

  // Get latest prices
  static async getLatestPrices(exchange?: string) {
    try {
      let query = `
        SELECT DISTINCT ON (exchange, symbol) 
          exchange, symbol, bid_price, ask_price, timestamp
        FROM price_feed
      `;
      const values = [];
      
      if (exchange) {
        query += ' WHERE exchange = $1';
        values.push(exchange);
      }
      
      query += ' ORDER BY exchange, symbol, timestamp DESC';
      
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting latest prices:', error);
      throw error;
    }
  }

  // Get recent arbitrage opportunities
  static async getRecentOpportunities(limit: number = 10) {
    try {
      const query = `
        SELECT * FROM arbitrage_alerts
        WHERE status = 'detected'
        ORDER BY profit_percentage DESC, detected_at DESC
        LIMIT $1;
      `;
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting opportunities:', error);
      throw error;
    }
  }

  // Update daily stats
  static async updateDailyStats(data: {
    volume: number;
    grossProfit: number;
    netProfit: number;
    successful?: boolean;
  }) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const query = `
        INSERT INTO daily_stats (date, total_volume, total_trades, successful_trades, gross_profit, net_profit)
        VALUES ($1, $2, 1, $3, $4, $5)
        ON CONFLICT (date) DO UPDATE
        SET total_volume = daily_stats.total_volume + $2,
            total_trades = daily_stats.total_trades + 1,
            successful_trades = daily_stats.successful_trades + $3,
            gross_profit = daily_stats.gross_profit + $4,
            net_profit = daily_stats.net_profit + $5;
      `;
      const values = [
        today,
        data.volume,
        data.successful ? 1 : 0,
        data.grossProfit,
        data.netProfit
      ];
      await pool.query(query, values);
    } catch (error) {
      console.error('Error updating daily stats:', error);
      throw error;
    }
  }

  // Get daily stats
  static async getDailyStats(date?: string) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const query = `
        SELECT * FROM daily_stats WHERE date = $1;
      `;
      const result = await pool.query(query, [targetDate]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting daily stats:', error);
      throw error;
    }
  }

  // Clean up old data (keep last 7 days)
  static async cleanupOldData(daysToKeep: number = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      await pool.query(
        'DELETE FROM price_feed WHERE timestamp < $1',
        [cutoffDate]
      );
      
      console.log(`Cleaned up price data older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      throw error;
    }
  }
}

// Export pool for direct queries if needed
export { pool };