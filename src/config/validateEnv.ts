import { config } from 'dotenv';
import { logger } from '../utils/logger.js';

config();

interface RequiredEnvVars {
  // Database
  DB_HOST: string;
  DB_PORT: string;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  
  // Exchange APIs (at least one required)
  BINANCE_API_KEY?: string;
  ZEBPAY_API_KEY?: string;
  KUCOIN_API_KEY?: string;
  COINSWITCH_API_KEY?: string;
  
  // Core settings
  NODE_ENV: string;
  PORT: string;
}

interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required database vars
  const dbVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  dbVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`Missing required database variable: ${varName}`);
    }
  });
  
  // Check at least one exchange API is configured
  const exchangeKeys = [
    'BINANCE_API_KEY',
    'ZEBPAY_API_KEY', 
    'KUCOIN_API_KEY',
    'COINSWITCH_API_KEY'
  ];
  
  const hasExchangeKey = exchangeKeys.some(key => process.env[key]);
  if (!hasExchangeKey) {
    errors.push('At least one exchange API key must be configured');
  }
  
  // Check core settings
  if (!process.env.NODE_ENV) {
    warnings.push('NODE_ENV not set, defaulting to development');
    process.env.NODE_ENV = 'development';
  }
  
  if (!process.env.PORT) {
    warnings.push('PORT not set, defaulting to 3000');
    process.env.PORT = '3000';
  }
  
  // Security warnings
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.ENABLE_AUTO_TRADING || process.env.ENABLE_AUTO_TRADING === 'true') {
      warnings.push('Auto-trading is enabled in production - ensure this is intentional');
    }
    
    if (parseInt(process.env.MAX_TRADE_AMOUNT || '0') > 10000) {
      warnings.push('MAX_TRADE_AMOUNT is set very high for production');
    }
  }
  
  // Check for exposed secrets in common locations
  if (process.env.DB_PASSWORD === 'your_postgres_password') {
    errors.push('Default database password detected - please set a secure password');
  }
  
  const isValid = errors.length === 0;
  
  // Log results
  if (!isValid) {
    logger.error('Environment validation failed:', errors);
  }
  
  if (warnings.length > 0) {
    warnings.forEach(warning => logger.warn(warning));
  }
  
  return { isValid, errors, warnings };
}

export function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export function getEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}