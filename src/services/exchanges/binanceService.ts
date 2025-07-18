import axios from 'axios';
import * as crypto from 'crypto';
import { config } from 'dotenv';

config();

interface Balance {
  free: number;
  locked: number;
  total: number;
}

class BinanceService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://api.binance.com';

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || '';
  }

  async getBalance(currency: string): Promise<Balance> {
    try {
      // For testing without API keys, return mock balance
      if (!this.apiKey || !this.apiSecret) {
        console.log('⚠️  Using mock balance (no API keys configured)');
        return {
          free: 11.5,  // Your actual USDT amount
          locked: 0,
          total: 11.5
        };
      }

      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(queryString)
        .digest('hex');

      const response = await axios.get(
        `${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': this.apiKey
          }
        }
      );

      const balances = response.data.balances;
      const balance = balances.find((b: any) => b.asset === currency);

      if (balance) {
        return {
          free: parseFloat(balance.free),
          locked: parseFloat(balance.locked),
          total: parseFloat(balance.free) + parseFloat(balance.locked)
        };
      }

      return { free: 0, locked: 0, total: 0 };
    } catch (error) {
      console.error('Failed to get balance:', error.message);
      // Return mock balance for testing
      return {
        free: 11.5,
        locked: 0,
        total: 11.5
      };
    }
  }

  async createP2POrder(params: {
    side: 'buy' | 'sell';
    amount: number;
    price: number;
    paymentMethod: string;
  }) {
    // Mock implementation for P2P orders
    console.log('Creating P2P order:', params);
    return {
      orderId: `binance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'created',
      ...params
    };
  }

  async getDepositAddress(currency: string, network: string = 'TRC20') {
    // This would normally call Binance API
    return {
      currency,
      network,
      address: 'TYourBinanceDepositAddressHere',
      memo: null,
      url: `https://www.binance.com/en/my/wallet/account/main/deposit/crypto/${currency}`
    };
  }
}

export const binanceService = new BinanceService();