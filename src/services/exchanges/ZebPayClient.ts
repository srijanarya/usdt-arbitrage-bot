import { BaseExchangeClient, OrderRequest, OrderResponse, Balance, DepositAddress, WithdrawalRequest, WithdrawalResponse } from './BaseExchangeClient';
import crypto from 'crypto';

/**
 * ZebPay Exchange Client
 * Documentation: https://zebpay.com/api
 */
export class ZebPayClient extends BaseExchangeClient {
  constructor(apiKey: string, apiSecret: string) {
    super(apiKey, apiSecret, 'https://api.zebpay.com');
  }

  /**
   * Add ZebPay authentication headers
   */
  protected addAuthHeaders(config: any): any {
    const timestamp = this.getTimestamp();
    const method = config.method?.toUpperCase() || 'GET';
    const path = new URL(config.url || '', this.baseURL).pathname;
    
    // ZebPay signature format: timestamp + method + path + body
    let signatureData = `${timestamp}${method}${path}`;
    
    if (config.data && method !== 'GET') {
      signatureData += JSON.stringify(config.data);
    }
    
    const signature = this.signRequest(signatureData);
    
    return {
      ...config.headers,
      'X-API-KEY': this.apiKey,
      'X-SIGNATURE': signature,
      'X-TIMESTAMP': timestamp.toString()
    };
  }

  /**
   * Sign request using HMAC-SHA256
   */
  protected signRequest(data: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(data)
      .digest('hex');
  }

  /**
   * Create order on ZebPay
   */
  async createOrder(order: OrderRequest): Promise<OrderResponse> {
    try {
      this.validateOrder(order);
      
      const params = {
        pair: this.formatPair(order.pair),
        type: order.type,
        order_type: order.orderType,
        quantity: order.quantity.toString(),
        price: order.price?.toString()
      };
      
      const response = await this.client.post('/api/v2/orders', params);
      const data = this.parseResponse(response);
      
      return {
        id: data.id,
        status: this.mapOrderStatus(data.status),
        executedQty: parseFloat(data.executed_quantity || '0'),
        executedPrice: parseFloat(data.average_price || order.price || '0'),
        fee: parseFloat(data.fee || '0'),
        timestamp: new Date(data.created_at).getTime()
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, pair: string): Promise<boolean> {
    try {
      const response = await this.client.delete(`/api/v2/orders/${orderId}`, {
        data: { pair: this.formatPair(pair) }
      });
      
      const data = this.parseResponse(response);
      return data.status === 'cancelled';
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string, pair: string): Promise<OrderResponse> {
    try {
      const response = await this.client.get(`/api/v2/orders/${orderId}`, {
        params: { pair: this.formatPair(pair) }
      });
      
      const data = this.parseResponse(response);
      
      return {
        id: data.id,
        status: this.mapOrderStatus(data.status),
        executedQty: parseFloat(data.executed_quantity || '0'),
        executedPrice: parseFloat(data.average_price || '0'),
        fee: parseFloat(data.fee || '0'),
        timestamp: new Date(data.created_at).getTime()
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get account balance
   */
  async getBalance(currency?: string): Promise<Balance[]> {
    try {
      const response = await this.client.get('/api/v2/wallets');
      const data = this.parseResponse(response);
      
      const balances: Balance[] = Object.entries(data).map(([curr, balance]: [string, any]) => ({
        currency: curr.toUpperCase(),
        available: parseFloat(balance.available || '0'),
        locked: parseFloat(balance.locked || '0'),
        total: parseFloat(balance.total || '0')
      }));
      
      if (currency) {
        return balances.filter(b => b.currency === currency.toUpperCase());
      }
      
      return balances;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get deposit address
   */
  async getDepositAddress(currency: string, network: string): Promise<DepositAddress> {
    try {
      const response = await this.client.get(`/api/v2/deposit/address/${currency.toLowerCase()}`, {
        params: { network: network.toLowerCase() }
      });
      
      const data = this.parseResponse(response);
      
      return {
        currency: currency.toUpperCase(),
        address: data.address,
        network: network.toUpperCase(),
        memo: data.memo
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Create withdrawal
   */
  async createWithdrawal(withdrawal: WithdrawalRequest): Promise<WithdrawalResponse> {
    try {
      const params = {
        currency: withdrawal.currency.toLowerCase(),
        amount: withdrawal.amount.toString(),
        address: withdrawal.address,
        network: withdrawal.network.toLowerCase(),
        memo: withdrawal.memo
      };
      
      const response = await this.client.post('/api/v2/withdrawals', params);
      const data = this.parseResponse(response);
      
      return {
        id: data.id,
        txId: data.transaction_id,
        status: this.mapWithdrawalStatus(data.status),
        amount: parseFloat(data.amount),
        fee: parseFloat(data.fee || '0')
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get withdrawal status
   */
  async getWithdrawalStatus(withdrawalId: string): Promise<WithdrawalResponse> {
    try {
      const response = await this.client.get(`/api/v2/withdrawals/${withdrawalId}`);
      const data = this.parseResponse(response);
      
      return {
        id: data.id,
        txId: data.transaction_id,
        status: this.mapWithdrawalStatus(data.status),
        amount: parseFloat(data.amount),
        fee: parseFloat(data.fee || '0')
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Map ZebPay order status to standard status
   */
  private mapOrderStatus(status: string): OrderResponse['status'] {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'open':
        return 'pending';
      case 'partially_filled':
        return 'partial';
      case 'filled':
      case 'completed':
        return 'completed';
      case 'cancelled':
      case 'rejected':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  /**
   * Map withdrawal status
   */
  private mapWithdrawalStatus(status: string): WithdrawalResponse['status'] {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'submitted':
        return 'pending';
      case 'processing':
      case 'confirming':
        return 'processing';
      case 'completed':
      case 'success':
        return 'completed';
      case 'failed':
      case 'rejected':
      case 'cancelled':
        return 'failed';
      default:
        return 'pending';
    }
  }

  /**
   * Format pair for ZebPay (USDT-INR -> USDT-INR)
   */
  protected formatPair(pair: string): string {
    // ZebPay uses dash format
    return pair.toUpperCase();
  }

  /**
   * Get current market price
   */
  async getMarketPrice(pair: string, type: 'buy' | 'sell'): Promise<number> {
    try {
      const response = await this.client.get(`/api/v2/market/${this.formatPair(pair)}/ticker`);
      const data = this.parseResponse(response);
      
      return parseFloat(type === 'buy' ? data.buy : data.sell);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get order book
   */
  async getOrderBook(pair: string, depth: number = 10): Promise<any> {
    try {
      const response = await this.client.get(`/api/v2/market/${this.formatPair(pair)}/orderbook`, {
        params: { limit: depth }
      });
      
      return this.parseResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  }
}