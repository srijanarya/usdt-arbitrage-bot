import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { errorHandler, ErrorType, ErrorSeverity } from '../utils/errors/ErrorHandler';

export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    poolSize: number;
    connectionTimeout: number;
  };
  websocket: {
    reconnectAttempts: number;
    reconnectDelay: number;
    heartbeatInterval: number;
    endpoints: {
      [exchange: string]: {
        url: string;
        enabled: boolean;
      };
    };
  };
  telegram: {
    enabled: boolean;
    botToken?: string;
    chatId?: string;
    alertThreshold: number;
    cooldownMs: number;
  };
  trading: {
    minProfit: number;
    maxTradeAmount: number;
    tdsRate: number;
    fees: {
      [exchange: string]: {
        maker: number;
        taker: number;
      };
    };
  };
  monitoring: {
    healthCheckInterval: number;
    metricsRetention: number;
    alerting: {
      errorRateThreshold: number;
      downTimeThreshold: number;
    };
  };
  security: {
    apiRateLimit: number;
    maxConcurrentRequests: number;
    requestTimeout: number;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private configPath: string;
  private watcherEnabled = false;

  private readonly defaultConfig: AppConfig = {
    app: {
      name: 'USDT Arbitrage Bot',
      version: '1.0.0',
      environment: 'development'
    },
    database: {
      host: 'localhost',
      port: 5432,
      name: 'arbitrage_bot',
      user: 'postgres',
      password: '',
      poolSize: 20,
      connectionTimeout: 2000
    },
    websocket: {
      reconnectAttempts: 5,
      reconnectDelay: 5000,
      heartbeatInterval: 30000,
      endpoints: {
        zebpay: {
          url: 'wss://ws.zebpay.co/marketdata',
          enabled: true
        },
        coindcx: {
          url: 'wss://stream.coindcx.com',
          enabled: true
        },
        wazirx: {
          url: 'wss://stream.wazirx.com/stream',
          enabled: false
        }
      }
    },
    telegram: {
      enabled: true,
      alertThreshold: 0.1,
      cooldownMs: 30000
    },
    trading: {
      minProfit: 0.1,
      maxTradeAmount: 100000,
      tdsRate: 0.01,
      fees: {
        zebpay: {
          maker: 0.0015,
          taker: 0.0015
        },
        coindcx: {
          maker: 0.001,
          taker: 0.001
        },
        wazirx: {
          maker: 0.002,
          taker: 0.002
        }
      }
    },
    monitoring: {
      healthCheckInterval: 60000,
      metricsRetention: 7200000, // 2 hours
      alerting: {
        errorRateThreshold: 0.05,
        downTimeThreshold: 300000 // 5 minutes
      }
    },
    security: {
      apiRateLimit: 100,
      maxConcurrentRequests: 10,
      requestTimeout: 30000
    }
  };

  private constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from file or create default
   */
  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        
        // Merge with defaults to ensure all fields exist
        const mergedConfig = this.deepMerge(this.defaultConfig, fileConfig);
        
        // Override with environment variables
        this.applyEnvironmentOverrides(mergedConfig);
        
        console.log(chalk.green('✅ Configuration loaded successfully'));
        return mergedConfig;
      } else {
        console.log(chalk.yellow('No config file found, creating default configuration...'));
        this.saveConfig(this.defaultConfig);
        return this.defaultConfig;
      }
    } catch (error) {
      errorHandler.handleError(error as Error, {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.HIGH,
        operation: 'loadConfig'
      });
      
      console.log(chalk.yellow('Failed to load config, using defaults'));
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to file
   */
  private saveConfig(config: AppConfig): void {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      console.log(chalk.green(`Configuration saved to ${this.configPath}`));
    } catch (error) {
      errorHandler.handleError(error as Error, {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        operation: 'saveConfig'
      });
    }
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(config: AppConfig): void {
    // Database overrides
    if (process.env.DB_HOST) config.database.host = process.env.DB_HOST;
    if (process.env.DB_PORT) config.database.port = parseInt(process.env.DB_PORT);
    if (process.env.DB_NAME) config.database.name = process.env.DB_NAME;
    if (process.env.DB_USER) config.database.user = process.env.DB_USER;
    if (process.env.DB_PASSWORD) config.database.password = process.env.DB_PASSWORD;

    // Telegram overrides
    if (process.env.TELEGRAM_BOT_TOKEN) {
      config.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN;
      config.telegram.enabled = true;
    }
    if (process.env.TELEGRAM_CHAT_ID) {
      config.telegram.chatId = process.env.TELEGRAM_CHAT_ID;
    }

    // Environment override
    if (process.env.NODE_ENV) {
      config.app.environment = process.env.NODE_ENV as any;
    }

    // Trading overrides
    if (process.env.MIN_PROFIT) {
      config.trading.minProfit = parseFloat(process.env.MIN_PROFIT);
    }
    if (process.env.MAX_TRADE_AMOUNT) {
      config.trading.maxTradeAmount = parseFloat(process.env.MAX_TRADE_AMOUNT);
    }
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  /**
   * Check if value is object
   */
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Get configuration
   */
  get(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get specific configuration value
   */
  getValue<T>(path: string): T | undefined {
    const keys = path.split('.');
    let result: any = this.config;
    
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return undefined;
      }
    }
    
    return result as T;
  }

  /**
   * Update configuration value
   */
  setValue(path: string, value: any): void {
    const keys = path.split('.');
    let target: any = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in target) || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[keys[keys.length - 1]] = value;
    this.saveConfig(this.config);
  }

  /**
   * Reload configuration from file
   */
  reload(): void {
    console.log(chalk.blue('Reloading configuration...'));
    this.config = this.loadConfig();
  }

  /**
   * Watch configuration file for changes
   */
  enableWatcher(): void {
    if (this.watcherEnabled) return;
    
    try {
      fs.watchFile(this.configPath, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          console.log(chalk.blue('Configuration file changed, reloading...'));
          this.reload();
        }
      });
      
      this.watcherEnabled = true;
      console.log(chalk.green('Configuration file watcher enabled'));
    } catch (error) {
      errorHandler.handleError(error as Error, {
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.LOW,
        operation: 'enableWatcher'
      });
    }
  }

  /**
   * Disable configuration file watcher
   */
  disableWatcher(): void {
    if (!this.watcherEnabled) return;
    
    fs.unwatchFile(this.configPath);
    this.watcherEnabled = false;
    console.log(chalk.yellow('Configuration file watcher disabled'));
  }

  /**
   * Validate configuration
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate database config
    if (!this.config.database.host) {
      errors.push('Database host is required');
    }
    if (this.config.database.port < 1 || this.config.database.port > 65535) {
      errors.push('Database port must be between 1 and 65535');
    }

    // Validate WebSocket config
    if (this.config.websocket.reconnectAttempts < 1) {
      errors.push('WebSocket reconnect attempts must be at least 1');
    }

    // Validate trading config
    if (this.config.trading.minProfit < 0) {
      errors.push('Minimum profit cannot be negative');
    }
    if (this.config.trading.maxTradeAmount <= 0) {
      errors.push('Maximum trade amount must be positive');
    }

    // Validate telegram config
    if (this.config.telegram.enabled && !this.config.telegram.botToken) {
      errors.push('Telegram bot token is required when Telegram is enabled');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Export configuration for debugging
   */
  export(): string {
    const sanitized = { ...this.config };
    
    // Remove sensitive data
    if (sanitized.database.password) {
      sanitized.database.password = '***';
    }
    if (sanitized.telegram.botToken) {
      sanitized.telegram.botToken = '***';
    }
    
    return JSON.stringify(sanitized, null, 2);
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();