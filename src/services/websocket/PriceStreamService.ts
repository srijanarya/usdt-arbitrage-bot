import WebSocket from 'ws';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { errorHandler, ErrorType, ErrorSeverity } from '../../utils/errors/ErrorHandler';

interface PriceUpdate {
  exchange: string;
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  timestamp: Date;
  volume?: number;
}

interface WebSocketEndpoint {
  url: string;
  subscribeMessage: any;
  parseMessage: (data: any) => Promise<PriceUpdate | null>;
  heartbeatInterval?: number;
}

export class PriceStreamService extends EventEmitter {
  private connections: Map<string, WebSocket> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastPrices: Map<string, PriceUpdate> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds

  private endpoints: Map<string, WebSocketEndpoint> = new Map([
    ['zebpay', {
      url: 'wss://ws.zebpay.co/marketdata',
      subscribeMessage: {
        event: 'subscribe',
        channel: 'ticker',
        pair: ['USDT-INR']
      },
      parseMessage: async (data: any): Promise<PriceUpdate | null> => {
        try {
          if (data.event === 'ticker' && data.pair === 'USDT-INR') {
            return {
              exchange: 'zebpay',
              symbol: 'USDT/INR',
              buyPrice: parseFloat(data.buy),
              sellPrice: parseFloat(data.sell),
              timestamp: new Date(),
              volume: parseFloat(data.volume || 0)
            };
          }
        } catch (error) {
          await errorHandler.handleError(error as Error, {
            type: ErrorType.PARSE_ERROR,
            severity: ErrorSeverity.LOW,
            exchange: 'zebpay',
            operation: 'parseMessage',
            data: { rawData: data }
          });
        }
        return null;
      },
      heartbeatInterval: 30000
    }],
    ['coindcx', {
      url: 'wss://stream.coindcx.com',
      subscribeMessage: {
        channel: 'ticker',
        market: 'USDTINR'
      },
      parseMessage: async (data: any): Promise<PriceUpdate | null> => {
        try {
          if (data.channel === 'ticker' && data.market === 'USDTINR') {
            return {
              exchange: 'coindcx',
              symbol: 'USDT/INR',
              buyPrice: parseFloat(data.bid),
              sellPrice: parseFloat(data.ask),
              timestamp: new Date(data.timestamp),
              volume: parseFloat(data.volume || 0)
            };
          }
        } catch (error) {
          await errorHandler.handleError(error as Error, {
            type: ErrorType.PARSE_ERROR,
            severity: ErrorSeverity.LOW,
            exchange: 'coindcx',
            operation: 'parseMessage',
            data: { rawData: data }
          });
        }
        return null;
      },
      heartbeatInterval: 25000
    }]
  ]);

  constructor() {
    super();
    console.log(chalk.blue('🔌 Price Stream Service initialized'));
  }

  /**
   * Connect to all exchanges
   */
  async connectAll(): Promise<void> {
    console.log(chalk.yellow('🔗 Connecting to WebSocket feeds...'));
    
    for (const [exchange, endpoint] of this.endpoints) {
      await this.connect(exchange, endpoint);
    }
  }

  /**
   * Connect to specific exchange
   */
  private async connect(exchange: string, endpoint: WebSocketEndpoint): Promise<void> {
    try {
      console.log(chalk.blue(`Connecting to ${exchange}...`));
      
      const ws = new WebSocket(endpoint.url, {
        perMessageDeflate: false,
        handshakeTimeout: 10000
      });

      // Connection opened
      ws.on('open', () => {
        console.log(chalk.green(`✅ Connected to ${exchange}`));
        this.reconnectAttempts.set(exchange, 0);
        
        // Subscribe to ticker
        ws.send(JSON.stringify(endpoint.subscribeMessage));
        
        // Setup heartbeat
        if (endpoint.heartbeatInterval) {
          this.setupHeartbeat(exchange, ws, endpoint.heartbeatInterval);
        }
        
        this.emit('connected', exchange);
      });

      // Message received
      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          const priceUpdate = await endpoint.parseMessage(message);
          
          if (priceUpdate) {
            this.lastPrices.set(exchange, priceUpdate);
            this.emit('priceUpdate', priceUpdate);
            this.checkArbitrageOpportunity();
          }
        } catch (error) {
          await errorHandler.handleError(error as Error, {
            type: ErrorType.PARSE_ERROR,
            severity: ErrorSeverity.MEDIUM,
            exchange,
            operation: 'processMessage'
          });
        }
      });

      // Connection error
      ws.on('error', async (error) => {
        await errorHandler.handleError(error, {
          type: ErrorType.WEBSOCKET_CONNECTION,
          severity: ErrorSeverity.HIGH,
          exchange,
          operation: 'connection'
        });
        this.emit('error', { exchange, error });
      });

      // Connection closed
      ws.on('close', async (code, reason) => {
        console.log(chalk.yellow(`${exchange} connection closed: ${code} ${reason}`));
        this.connections.delete(exchange);
        this.clearHeartbeat(exchange);
        this.emit('disconnected', exchange);
        
        // Attempt reconnection
        await this.scheduleReconnect(exchange, endpoint);
      });

      // Handle pong for heartbeat
      ws.on('pong', () => {
        // Connection is alive
      });

      this.connections.set(exchange, ws);

    } catch (error) {
      await errorHandler.handleError(error as Error, {
        type: ErrorType.WEBSOCKET_CONNECTION,
        severity: ErrorSeverity.HIGH,
        exchange,
        operation: 'connect'
      });
      await this.scheduleReconnect(exchange, endpoint);
    }
  }

  /**
   * Setup heartbeat to keep connection alive
   */
  private setupHeartbeat(exchange: string, ws: WebSocket, interval: number): void {
    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, interval);
    
    this.heartbeatTimers.set(exchange, timer);
  }

  /**
   * Clear heartbeat timer
   */
  private clearHeartbeat(exchange: string): void {
    const timer = this.heartbeatTimers.get(exchange);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(exchange);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private async scheduleReconnect(exchange: string, endpoint: WebSocketEndpoint): Promise<void> {
    const attempts = this.reconnectAttempts.get(exchange) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      await errorHandler.handleError(
        new Error(`Max reconnection attempts reached for ${exchange}`),
        {
          type: ErrorType.WEBSOCKET_CONNECTION,
          severity: ErrorSeverity.CRITICAL,
          exchange,
          operation: 'reconnect',
          data: { attempts, maxAttempts: this.maxReconnectAttempts }
        }
      );
      this.emit('maxReconnectReached', exchange);
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, attempts);
    console.log(chalk.yellow(`Reconnecting to ${exchange} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`));
    
    const timer = setTimeout(() => {
      this.reconnectAttempts.set(exchange, attempts + 1);
      this.connect(exchange, endpoint);
    }, delay);
    
    this.reconnectTimers.set(exchange, timer);
  }

  /**
   * Check for arbitrage opportunities
   */
  private checkArbitrageOpportunity(): void {
    const prices = Array.from(this.lastPrices.values());
    
    if (prices.length < 2) return;

    for (let i = 0; i < prices.length; i++) {
      for (let j = 0; j < prices.length; j++) {
        if (i === j) continue;
        
        const buyFrom = prices[i];
        const sellTo = prices[j];
        
        // Calculate profit after fees and TDS
        const buyFee = 0.0015; // 0.15% for ZebPay
        const sellFee = 0.001; // 0.10% for CoinDCX
        const tds = 0.01; // 1% TDS
        
        const buyAmount = 100000; // ₹1,00,000 trade
        const usdtAmount = buyAmount / (buyFrom.buyPrice * (1 + buyFee));
        const sellAmount = usdtAmount * sellTo.sellPrice * (1 - sellFee) * (1 - tds);
        const profit = sellAmount - buyAmount;
        const profitPercent = (profit / buyAmount) * 100;
        
        if (profit > 0) {
          const opportunity = {
            buyExchange: buyFrom.exchange,
            sellExchange: sellTo.exchange,
            buyPrice: buyFrom.buyPrice,
            sellPrice: sellTo.sellPrice,
            profit,
            profitPercent,
            volume: buyAmount,
            timestamp: new Date()
          };
          
          this.emit('arbitrageOpportunity', opportunity);
        }
      }
    }
  }

  /**
   * Get current prices
   */
  getCurrentPrices(): Map<string, PriceUpdate> {
    return new Map(this.lastPrices);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { [exchange: string]: boolean } {
    const status: { [exchange: string]: boolean } = {};
    
    for (const exchange of this.endpoints.keys()) {
      const ws = this.connections.get(exchange);
      status[exchange] = ws ? ws.readyState === WebSocket.OPEN : false;
    }
    
    return status;
  }

  /**
   * Disconnect from all exchanges
   */
  disconnectAll(): void {
    console.log(chalk.yellow('Disconnecting from all WebSocket feeds...'));
    
    // Clear all timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.heartbeatTimers.values()) {
      clearInterval(timer);
    }
    
    // Close all connections
    for (const [exchange, ws] of this.connections) {
      ws.close();
      console.log(chalk.yellow(`Disconnected from ${exchange}`));
    }
    
    this.connections.clear();
    this.reconnectTimers.clear();
    this.heartbeatTimers.clear();
  }

  /**
   * Add custom exchange endpoint
   */
  addExchange(name: string, endpoint: WebSocketEndpoint): void {
    this.endpoints.set(name, endpoint);
    this.connect(name, endpoint);
  }
}

// Create singleton instance
export const priceStreamService = new PriceStreamService();