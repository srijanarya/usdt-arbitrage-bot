import dotenv from 'dotenv';

dotenv.config();

export interface TradingConfig {
  enabled: boolean;
  minProfitThreshold: number;
  maxTradeAmount: number;
  minTradeAmount: number;
  riskManagement: {
    maxDailyLoss: number;
    maxConsecutiveLosses: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  };
  exchanges: {
    [exchange: string]: {
      enabled: boolean;
      maxBalance: number;
      minOrderSize: number;
      tradingFees: number;
    };
  };
  notifications: {
    telegram: boolean;
    email: boolean;
    webhooks: string[];
  };
  safetyFeatures: {
    testMode: boolean;
    requireConfirmation: boolean;
    maxSlippage: number;
    priceValiditySeconds: number;
  };
}

export const tradingConfig: TradingConfig = {
  enabled: process.env.ENABLE_AUTO_TRADING === 'true',
  minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '100'),
  maxTradeAmount: parseFloat(process.env.MAX_TRADE_AMOUNT || '10000'),
  minTradeAmount: parseFloat(process.env.MIN_TRADE_AMOUNT || '1000'),
  
  riskManagement: {
    maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '5000'),
    maxConsecutiveLosses: parseInt(process.env.MAX_CONSECUTIVE_LOSSES || '3'),
    stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '2'),
    takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT || '3'),
  },
  
  exchanges: {
    zebpay: {
      enabled: true,
      maxBalance: 50000,
      minOrderSize: parseFloat(process.env.ZEBPAY_MIN_ORDER || '8'),
      tradingFees: 0.0025, // 0.25%
    },
    coindcx: {
      enabled: true,
      maxBalance: 50000,
      minOrderSize: parseFloat(process.env.COINDCX_MIN_ORDER || '5'),
      tradingFees: 0.001, // 0.1%
    },
    binance: {
      enabled: true,
      maxBalance: 100000,
      minOrderSize: parseFloat(process.env.BINANCE_MIN_ORDER || '12'),
      tradingFees: 0.001, // 0.1%
    },
    kucoin: {
      enabled: true,
      maxBalance: 50000,
      minOrderSize: parseFloat(process.env.KUCOIN_MIN_ORDER || '6'),
      tradingFees: 0.001, // 0.1%
    },
  },
  
  notifications: {
    telegram: process.env.TELEGRAM_ENABLED === 'true',
    email: process.env.EMAIL_NOTIFICATIONS === 'true',
    webhooks: process.env.WEBHOOK_URLS?.split(',') || [],
  },
  
  safetyFeatures: {
    testMode: process.env.NODE_ENV !== 'production',
    requireConfirmation: process.env.REQUIRE_CONFIRMATION === 'true',
    maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '0.5'), // 0.5%
    priceValiditySeconds: parseInt(process.env.PRICE_VALIDITY_SECONDS || '10'),
  },
};

// Validation
export function validateTradingConfig(): void {
  if (tradingConfig.minProfitThreshold < 0) {
    throw new Error('MIN_PROFIT_THRESHOLD must be positive');
  }
  
  if (tradingConfig.maxTradeAmount < tradingConfig.minTradeAmount) {
    throw new Error('MAX_TRADE_AMOUNT must be greater than MIN_TRADE_AMOUNT');
  }
  
  if (tradingConfig.riskManagement.stopLossPercent >= 100) {
    throw new Error('STOP_LOSS_PERCENT must be less than 100');
  }
  
  console.log('✅ Trading configuration validated successfully');
}