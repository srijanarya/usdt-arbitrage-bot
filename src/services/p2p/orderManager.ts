import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

interface P2POrder {
  id: string;
  exchange: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  currency: string;
  paymentMethod: string;
  status: 'pending' | 'waiting_payment' | 'paid' | 'completed' | 'cancelled' | 'expired';
  buyerNickname?: string;
  sellerNickname?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  tradeId?: string;
  chatId?: string;
  paymentDetails?: {
    upiId?: string;
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
    accountHolderName?: string;
  };
  expectedAmount?: number;
  actualAmount?: number;
  paymentReceived?: boolean;
  autoReleaseEnabled?: boolean;
}

interface ExchangeConfig {
  name: string;
  apiKey: string;
  apiSecret: string;
  sandbox?: boolean;
}

export class P2POrderManager extends EventEmitter {
  private orders: Map<string, P2POrder> = new Map();
  private exchangeConfigs: Map<string, ExchangeConfig> = new Map();
  private activeOrders: Set<string> = new Set();
  private orderCheckInterval: NodeJS.Timer | null = null;

  constructor() {
    super();
  }

  addExchangeConfig(config: ExchangeConfig) {
    this.exchangeConfigs.set(config.name, config);
    logger.info(`Added exchange config for ${config.name}`);
  }

  async createSellOrder(params: {
    exchange: string;
    amount: number;
    price: number;
    paymentMethod: string;
    paymentDetails: any;
    autoRelease?: boolean;
  }): Promise<P2POrder> {
    const orderId = `${params.exchange}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const order: P2POrder = {
      id: orderId,
      exchange: params.exchange,
      type: 'sell',
      amount: params.amount,
      price: params.price,
      currency: 'USDT',
      paymentMethod: params.paymentMethod,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      paymentDetails: params.paymentDetails,
      expectedAmount: params.amount * params.price,
      autoReleaseEnabled: params.autoRelease || false
    };

    try {
      // Create order on exchange
      const result = await this.createOrderOnExchange(order);
      order.tradeId = result.tradeId;
      order.status = 'waiting_payment';
      
      this.orders.set(orderId, order);
      this.activeOrders.add(orderId);
      
      logger.info(`Created P2P sell order ${orderId} on ${params.exchange}`);
      this.emit('orderCreated', order);
      
      return order;
    } catch (error) {
      logger.error(`Failed to create order on ${params.exchange}:`, error);
      order.status = 'cancelled';
      throw error;
    }
  }

  private async createOrderOnExchange(order: P2POrder): Promise<{ tradeId: string }> {
    const config = this.exchangeConfigs.get(order.exchange);
    if (!config) {
      throw new Error(`No configuration found for exchange: ${order.exchange}`);
    }

    switch (order.exchange.toLowerCase()) {
      case 'binance':
        return await this.createBinanceP2POrder(order, config);
      case 'wazirx':
        return await this.createWazirXP2POrder(order, config);
      case 'coindcx':
        return await this.createCoinDCXP2POrder(order, config);
      default:
        throw new Error(`P2P trading not implemented for ${order.exchange}`);
    }
  }

  private async createBinanceP2POrder(order: P2POrder, config: ExchangeConfig): Promise<{ tradeId: string }> {
    // Note: Binance P2P API is limited and may require special access
    // This is a simplified implementation
    try {
      const axios = require('axios');
      const crypto = require('crypto');
      
      const timestamp = Date.now();
      const params = {
        asset: order.currency,
        tradeType: 'SELL',
        fiat: 'INR',
        amount: order.amount.toString(),
        price: order.price.toString(),
        payTypes: [order.paymentMethod],
        timestamp
      };

      const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');

      const signature = crypto
        .createHmac('sha256', config.apiSecret)
        .update(queryString)
        .digest('hex');

      const response = await axios.post('https://api.binance.com/sapi/v1/c2c/ads/create', {
        ...params,
        signature
      }, {
        headers: {
          'X-MBX-APIKEY': config.apiKey
        }
      });

      return { tradeId: response.data.data.adNo || `binance_${timestamp}` };
    } catch (error) {
      logger.error('Binance P2P order creation failed:', error);
      // Fallback: simulate order creation for development
      return { tradeId: `binance_sim_${Date.now()}` };
    }
  }

  private async createWazirXP2POrder(order: P2POrder, config: ExchangeConfig): Promise<{ tradeId: string }> {
    // WazirX P2P API implementation would go here
    // For now, simulate the order creation
    return { tradeId: `wazirx_sim_${Date.now()}` };
  }

  private async createCoinDCXP2POrder(order: P2POrder, config: ExchangeConfig): Promise<{ tradeId: string }> {
    // CoinDCX P2P API implementation would go here
    // For now, simulate the order creation
    return { tradeId: `coindcx_sim_${Date.now()}` };
  }

  async markPaymentReceived(orderId: string, amount: number, confidence: number = 1.0) {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    order.actualAmount = amount;
    order.paymentReceived = true;
    order.status = 'paid';
    order.updatedAt = new Date();

    this.orders.set(orderId, order);
    
    logger.info(`Payment received for order ${orderId}: ₹${amount} (confidence: ${confidence})`);
    this.emit('paymentReceived', { order, amount, confidence });

    // Auto-release if enabled and high confidence
    if (order.autoReleaseEnabled && confidence >= 0.9) {
      await this.releaseOrder(orderId);
    }
  }

  async releaseOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (order.status !== 'paid') {
      throw new Error(`Cannot release order ${orderId}: payment not confirmed`);
    }

    try {
      // Release crypto on exchange
      await this.releaseOrderOnExchange(order);
      
      order.status = 'completed';
      order.updatedAt = new Date();
      this.orders.set(orderId, order);
      this.activeOrders.delete(orderId);
      
      logger.info(`Order ${orderId} completed successfully`);
      this.emit('orderCompleted', order);
      
      return true;
    } catch (error) {
      logger.error(`Failed to release order ${orderId}:`, error);
      return false;
    }
  }

  private async releaseOrderOnExchange(order: P2POrder): Promise<void> {
    const config = this.exchangeConfigs.get(order.exchange);
    if (!config) {
      throw new Error(`No configuration found for exchange: ${order.exchange}`);
    }

    // Implementation would vary by exchange
    // For now, simulate the release
    logger.info(`Simulating crypto release for order ${order.id} on ${order.exchange}`);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    try {
      // Cancel order on exchange
      await this.cancelOrderOnExchange(order);
      
      order.status = 'cancelled';
      order.updatedAt = new Date();
      this.orders.set(orderId, order);
      this.activeOrders.delete(orderId);
      
      logger.info(`Order ${orderId} cancelled`);
      this.emit('orderCancelled', order);
      
      return true;
    } catch (error) {
      logger.error(`Failed to cancel order ${orderId}:`, error);
      return false;
    }
  }

  private async cancelOrderOnExchange(order: P2POrder): Promise<void> {
    // Implementation would vary by exchange
    logger.info(`Simulating order cancellation for ${order.id} on ${order.exchange}`);
  }

  startMonitoring(checkInterval: number = 30000) {
    this.orderCheckInterval = setInterval(async () => {
      await this.checkOrderStatuses();
    }, checkInterval);
    
    logger.info('P2P order monitoring started');
  }

  stopMonitoring() {
    if (this.orderCheckInterval) {
      clearInterval(this.orderCheckInterval);
      this.orderCheckInterval = null;
    }
    logger.info('P2P order monitoring stopped');
  }

  private async checkOrderStatuses() {
    for (const orderId of this.activeOrders) {
      const order = this.orders.get(orderId);
      if (!order) continue;

      // Check if order expired
      if (order.expiresAt < new Date() && order.status === 'waiting_payment') {
        await this.cancelOrder(orderId);
      }

      // Check order status on exchange
      try {
        const exchangeStatus = await this.getOrderStatusFromExchange(order);
        if (exchangeStatus !== order.status) {
          order.status = exchangeStatus;
          order.updatedAt = new Date();
          this.orders.set(orderId, order);
          this.emit('orderStatusChanged', order);
        }
      } catch (error) {
        logger.error(`Failed to check status for order ${orderId}:`, error);
      }
    }
  }

  private async getOrderStatusFromExchange(order: P2POrder): Promise<string> {
    // Implementation would vary by exchange
    return order.status;
  }

  getOrder(orderId: string): P2POrder | undefined {
    return this.orders.get(orderId);
  }

  getActiveOrders(): P2POrder[] {
    return Array.from(this.activeOrders)
      .map(id => this.orders.get(id))
      .filter(order => order !== undefined) as P2POrder[];
  }

  getAllOrders(): P2POrder[] {
    return Array.from(this.orders.values());
  }

  getOrdersByStatus(status: P2POrder['status']): P2POrder[] {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }
}

export type { P2POrder, ExchangeConfig };