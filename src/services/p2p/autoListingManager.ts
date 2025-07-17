import { EventEmitter } from 'events';
import axios from 'axios';
import { logger } from '../../utils/logger';
import { binanceService } from '../exchanges/binanceService';
import { p2pOrderManager } from './orderManager';
import { config } from 'dotenv';

config();

interface AutoListConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  maxOrders: number;
  minBalance: number; // Minimum USDT to keep
  priceStrategy: 'competitive' | 'fixed' | 'dynamic';
  targetPrice?: number;
  priceOffset?: number; // Percentage below market
  expiryTime: number; // Order expiry in minutes
  autoRelistDelay: number; // Delay before relisting
}

interface OrderStatus {
  id: string;
  status: 'active' | 'expired' | 'completed' | 'cancelled';
  amount: number;
  price: number;
  createdAt: Date;
  expiresAt: Date;
  relistCount: number;
}

interface BalanceInfo {
  spot: number;
  p2p: number;
  total: number;
  available: number;
  locked: number;
  lastUpdated: Date;
}

export class AutoListingManager extends EventEmitter {
  private config: AutoListConfig;
  private activeOrders: Map<string, OrderStatus> = new Map();
  private balanceInfo: BalanceInfo = {
    spot: 0,
    p2p: 0,
    total: 0,
    available: 0,
    locked: 0,
    lastUpdated: new Date()
  };
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private balanceCheckInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<AutoListConfig>) {
    super();
    
    this.config = {
      enabled: true,
      checkInterval: 30000, // 30 seconds
      maxOrders: 3,
      minBalance: 1, // Keep at least 1 USDT
      priceStrategy: 'competitive',
      priceOffset: 0.5, // 0.5% below market
      expiryTime: 15, // 15 minutes
      autoRelistDelay: 5000, // 5 seconds
      ...config
    };
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Auto-listing manager already running');
      return;
    }

    logger.info('🚀 Starting auto-listing manager');
    this.isRunning = true;

    // Initial balance check
    await this.updateBalance();

    // Start monitoring loops
    this.startOrderMonitoring();
    this.startBalanceMonitoring();

    this.emit('started');
  }

  stop() {
    logger.info('🛑 Stopping auto-listing manager');
    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.balanceCheckInterval) {
      clearInterval(this.balanceCheckInterval);
      this.balanceCheckInterval = null;
    }

    this.emit('stopped');
  }

  // Balance monitoring
  private async updateBalance(): Promise<void> {
    try {
      // Get spot wallet balance
      const spotBalance = await binanceService.getBalance('USDT');
      
      // Get P2P balance (this would need Binance P2P API)
      // For now, we'll estimate based on active orders
      const p2pLocked = Array.from(this.activeOrders.values())
        .filter(order => order.status === 'active')
        .reduce((sum, order) => sum + order.amount, 0);

      this.balanceInfo = {
        spot: spotBalance.free,
        p2p: spotBalance.locked + p2pLocked,
        total: spotBalance.free + spotBalance.locked,
        available: spotBalance.free,
        locked: spotBalance.locked + p2pLocked,
        lastUpdated: new Date()
      };

      logger.info(`💰 Balance updated - Total: ${this.balanceInfo.total} USDT, Available: ${this.balanceInfo.available} USDT`);
      this.emit('balanceUpdated', this.balanceInfo);

      // Check if we need to cancel orders due to low balance
      if (this.balanceInfo.available < this.config.minBalance) {
        logger.warn(`⚠️ Low balance detected: ${this.balanceInfo.available} USDT`);
        await this.handleLowBalance();
      }

    } catch (error) {
      logger.error('Failed to update balance:', error);
      this.emit('error', { type: 'balanceUpdate', error });
    }
  }

  private startBalanceMonitoring() {
    // Check balance every 10 seconds
    this.balanceCheckInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.updateBalance();
      }
    }, 10000);
  }

  // Order monitoring
  private startOrderMonitoring() {
    this.checkInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.checkExpiredOrders();
        await this.maintainOrderCount();
      }
    }, this.config.checkInterval);

    // Initial check
    this.checkExpiredOrders();
  }

  private async checkExpiredOrders() {
    const now = new Date();
    const expiredOrders: OrderStatus[] = [];

    for (const [orderId, order] of this.activeOrders) {
      if (order.status === 'active' && now > order.expiresAt) {
        order.status = 'expired';
        expiredOrders.push(order);
        logger.info(`📅 Order expired: ${orderId}`);
      }
    }

    // Auto-relist expired orders
    for (const order of expiredOrders) {
      if (this.config.enabled && this.balanceInfo.available >= order.amount) {
        await this.relistOrder(order);
      } else {
        this.activeOrders.delete(order.id);
        this.emit('orderRemoved', order);
      }
    }
  }

  private async relistOrder(expiredOrder: OrderStatus) {
    logger.info(`🔄 Auto-relisting order: ${expiredOrder.amount} USDT`);

    try {
      // Wait before relisting
      await new Promise(resolve => setTimeout(resolve, this.config.autoRelistDelay));

      // Get new price based on strategy
      const newPrice = await this.calculatePrice(expiredOrder.amount);

      // Create new order
      const newOrder = await this.createSellOrder(expiredOrder.amount, newPrice);
      
      if (newOrder) {
        // Remove old order
        this.activeOrders.delete(expiredOrder.id);
        
        // Add new order
        this.activeOrders.set(newOrder.id, {
          ...newOrder,
          relistCount: expiredOrder.relistCount + 1
        });

        logger.info(`✅ Order relisted: ${newOrder.id} at ₹${newPrice}`);
        this.emit('orderRelisted', {
          oldOrder: expiredOrder,
          newOrder,
          relistCount: expiredOrder.relistCount + 1
        });
      }

    } catch (error) {
      logger.error('Failed to relist order:', error);
      this.emit('error', { type: 'relist', error, order: expiredOrder });
    }
  }

  private async calculatePrice(amount: number): Promise<number> {
    switch (this.config.priceStrategy) {
      case 'fixed':
        return this.config.targetPrice || 90;

      case 'competitive':
        try {
          // Get current market price
          const marketPrice = await this.getMarketPrice();
          // Price slightly below market
          const competitivePrice = marketPrice * (1 - (this.config.priceOffset || 0.5) / 100);
          return Math.round(competitivePrice * 100) / 100;
        } catch (error) {
          logger.error('Failed to get market price:', error);
          return this.config.targetPrice || 90;
        }

      case 'dynamic':
        // Dynamic pricing based on order age, market conditions, etc.
        const basePrice = await this.getMarketPrice();
        const urgencyFactor = 1 - (this.activeOrders.size / 10); // Lower price with more orders
        return Math.round(basePrice * urgencyFactor * 100) / 100;

      default:
        return 90;
    }
  }

  private async getMarketPrice(): Promise<number> {
    try {
      const response = await axios.post(
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
        {
          page: 1,
          rows: 5,
          payTypes: ["UPI"],
          tradeType: "SELL",
          asset: "USDT",
          fiat: "INR"
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        }
      );

      const ads = response.data.data || [];
      if (ads.length > 0) {
        const prices = ads.slice(0, 3).map(ad => parseFloat(ad.adv.price));
        return prices.reduce((a, b) => a + b, 0) / prices.length;
      }
      
      return 90; // Fallback
    } catch (error) {
      logger.error('Failed to fetch market price:', error);
      return 90;
    }
  }

  private async createSellOrder(amount: number, price: number): Promise<OrderStatus | null> {
    try {
      // Check balance before creating order
      if (this.balanceInfo.available < amount) {
        logger.warn(`Insufficient balance for order: ${amount} USDT`);
        return null;
      }

      // Create order through P2P order manager
      const p2pOrder = await p2pOrderManager.createSellOrder({
        exchange: 'binance',
        amount,
        price,
        paymentMethod: 'UPI',
        paymentDetails: {
          upiId: process.env.UPI_ID || 'your-upi@bank',
          accountHolderName: 'Your Name'
        },
        autoRelease: true
      });

      if (p2pOrder) {
        const orderStatus: OrderStatus = {
          id: p2pOrder.id,
          status: 'active',
          amount,
          price,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + this.config.expiryTime * 60 * 1000),
          relistCount: 0
        };

        return orderStatus;
      }

      return null;
    } catch (error) {
      logger.error('Failed to create sell order:', error);
      return null;
    }
  }

  private async maintainOrderCount() {
    const activeCount = Array.from(this.activeOrders.values())
      .filter(order => order.status === 'active').length;

    if (activeCount < this.config.maxOrders && this.balanceInfo.available >= 10) {
      const ordersToCreate = this.config.maxOrders - activeCount;
      
      for (let i = 0; i < ordersToCreate; i++) {
        const amount = Math.min(11.5, this.balanceInfo.available - this.config.minBalance);
        if (amount >= 10) {
          const price = await this.calculatePrice(amount);
          const order = await this.createSellOrder(amount, price);
          
          if (order) {
            this.activeOrders.set(order.id, order);
            logger.info(`📝 Created new order: ${amount} USDT at ₹${price}`);
            this.emit('orderCreated', order);
          }
        }
      }
    }
  }

  private async handleLowBalance() {
    logger.warn('🚨 Handling low balance situation');
    
    // Cancel orders starting from highest price
    const sortedOrders = Array.from(this.activeOrders.values())
      .filter(order => order.status === 'active')
      .sort((a, b) => b.price - a.price);

    for (const order of sortedOrders) {
      if (this.balanceInfo.available < this.config.minBalance) {
        await this.cancelOrder(order.id);
        this.balanceInfo.available += order.amount;
      } else {
        break;
      }
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      logger.info(`❌ Cancelling order: ${orderId}`);
      
      // Cancel through P2P manager
      // This would need actual Binance P2P API implementation
      
      const order = this.activeOrders.get(orderId);
      if (order) {
        order.status = 'cancelled';
        this.activeOrders.delete(orderId);
        this.emit('orderCancelled', order);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to cancel order:', error);
      return false;
    }
  }

  // Public methods
  getStatus() {
    const activeOrders = Array.from(this.activeOrders.values())
      .filter(order => order.status === 'active');

    return {
      isRunning: this.isRunning,
      config: this.config,
      balance: this.balanceInfo,
      activeOrders: activeOrders.length,
      totalLocked: activeOrders.reduce((sum, order) => sum + order.amount, 0),
      orders: activeOrders.map(order => ({
        id: order.id,
        amount: order.amount,
        price: order.price,
        expiresIn: Math.max(0, (order.expiresAt.getTime() - Date.now()) / 1000 / 60), // minutes
        relistCount: order.relistCount
      }))
    };
  }

  updateConfig(newConfig: Partial<AutoListConfig>) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Auto-listing config updated:', newConfig);
    this.emit('configUpdated', this.config);
  }

  getBalance(): BalanceInfo {
    return this.balanceInfo;
  }
}

// Export singleton instance
export const autoListingManager = new AutoListingManager();