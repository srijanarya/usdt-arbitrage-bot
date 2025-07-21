import WebSocket from 'ws';
import { EventEmitter } from 'events';
import chalk from 'chalk';

interface PriceData {
  exchange: string;
  buyPrice: number;
  sellPrice: number;
  timestamp: number;
  volume?: number;
}

interface ConnectionConfig {
  maxRetries: number;
  retryDelay: number;
  heartbeatInterval: number;
  reconnectBackoff: number;
  maxReconnectDelay: number;
}

interface ExchangeConnection {
  ws: WebSocket | null;
  url: string;
  connected: boolean;
  retryCount: number;
  lastHeartbeat: number;
  reconnectTimer?: NodeJS.Timeout;
  heartbeatTimer?: NodeJS.Timeout;
}

export class EnhancedWebSocketMonitor extends EventEmitter {
  private connections: Map<string, ExchangeConnection> = new Map();
  private lastPrices: Map<string, PriceData> = new Map();
  private config: ConnectionConfig = {
    maxRetries: 5,
    retryDelay: 1000,
    heartbeatInterval: 30000,
    reconnectBackoff: 1.5,
    maxReconnectDelay: 60000
  };
  private isRunning = false;
  private priceValidationEnabled = true;
  private staleDataThreshold = 60000; // 1 minute

  constructor() {
    super();
    this.setupExchangeEndpoints();
  }

  private setupExchangeEndpoints() {
    // Configure WebSocket endpoints for each exchange
    const endpoints = {
      zebpay: 'wss://ws.zebpay.com/marketdata',
      binance_p2p: 'wss://stream.binance.com:9443/ws/usdtinr@ticker',
      coindcx: 'wss://stream.coindcx.com'
    };

    Object.entries(endpoints).forEach(([exchange, url]) => {
      this.connections.set(exchange, {
        ws: null,
        url,
        connected: false,
        retryCount: 0,
        lastHeartbeat: Date.now()
      });
    });
  }

  /**
   * Start monitoring all exchanges
   */
  async start() {
    if (this.isRunning) {
      console.log(chalk.yellow('WebSocket monitor already running'));
      return;
    }

    this.isRunning = true;
    console.log(chalk.bgBlue.white(' 🌐 Starting Enhanced WebSocket Monitor \n'));

    for (const [exchange, connection] of this.connections) {
      await this.connectExchange(exchange, connection);
    }

    // Start stale data checker
    this.startStaleDataChecker();

    this.emit('started');
  }

  /**
   * Connect to specific exchange
   */
  private async connectExchange(exchange: string, connection: ExchangeConnection) {
    try {
      console.log(chalk.blue(`Connecting to ${exchange}...`));
      
      // Clean up existing connection
      if (connection.ws) {
        connection.ws.removeAllListeners();
        connection.ws.close();
      }

      // Create new WebSocket connection
      connection.ws = new WebSocket(connection.url, {
        perMessageDeflate: false,
        handshakeTimeout: 10000
      });

      // Set up event handlers
      this.setupWebSocketHandlers(exchange, connection);

      // Set up heartbeat
      this.setupHeartbeat(exchange, connection);

    } catch (error) {
      console.error(chalk.red(`Failed to connect to ${exchange}:`, error.message));
      this.scheduleReconnect(exchange, connection);
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(exchange: string, connection: ExchangeConnection) {
    if (!connection.ws) return;

    connection.ws.on('open', () => {
      console.log(chalk.green(`✅ Connected to ${exchange}`));
      connection.connected = true;
      connection.retryCount = 0;
      connection.lastHeartbeat = Date.now();
      
      this.emit('connected', exchange);
      
      // Subscribe to required channels
      this.subscribeToChannels(exchange, connection.ws);
    });

    connection.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(exchange, message);
        connection.lastHeartbeat = Date.now();
      } catch (error) {
        console.error(chalk.red(`Error parsing message from ${exchange}:`, error.message));
        this.emit('error', { exchange, error });
      }
    });

    connection.ws.on('error', (error: Error) => {
      console.error(chalk.red(`WebSocket error for ${exchange}:`, error.message));
      connection.connected = false;
      this.emit('error', { exchange, error });
    });

    connection.ws.on('close', (code: number, reason: string) => {
      console.log(chalk.yellow(`Connection closed for ${exchange}: ${code} ${reason}`));
      connection.connected = false;
      connection.ws = null;
      
      this.emit('disconnected', exchange);
      
      if (this.isRunning) {
        this.scheduleReconnect(exchange, connection);
      }
    });

    connection.ws.on('ping', () => {
      connection.ws?.pong();
      connection.lastHeartbeat = Date.now();
    });
  }

  /**
   * Subscribe to required channels for each exchange
   */
  private subscribeToChannels(exchange: string, ws: WebSocket) {
    switch (exchange) {
      case 'zebpay':
        ws.send(JSON.stringify({
          type: 'subscribe',
          channels: ['ticker'],
          pairs: ['USDT-INR']
        }));
        break;
        
      case 'binance_p2p':
        // Binance subscription is handled via URL
        break;
        
      case 'coindcx':
        ws.send(JSON.stringify({
          event: 'subscribe',
          channel: 'ticker',
          markets: ['USDTINR']
        }));
        break;
    }
  }

  /**
   * Handle incoming messages from exchanges
   */
  private handleMessage(exchange: string, message: any) {
    let priceData: PriceData | null = null;

    try {
      switch (exchange) {
        case 'zebpay':
          if (message.type === 'ticker' && message.pair === 'USDT-INR') {
            priceData = {
              exchange,
              buyPrice: parseFloat(message.buy),
              sellPrice: parseFloat(message.sell),
              timestamp: Date.now(),
              volume: parseFloat(message.volume)
            };
          }
          break;

        case 'binance_p2p':
          if (message.s === 'USDTINR') {
            priceData = {
              exchange,
              buyPrice: parseFloat(message.b), // Best bid
              sellPrice: parseFloat(message.a), // Best ask
              timestamp: parseInt(message.E),
              volume: parseFloat(message.v)
            };
          }
          break;

        case 'coindcx':
          if (message.channel === 'ticker' && message.market === 'USDTINR') {
            priceData = {
              exchange,
              buyPrice: parseFloat(message.bid),
              sellPrice: parseFloat(message.ask),
              timestamp: Date.now(),
              volume: parseFloat(message.volume)
            };
          }
          break;
      }

      if (priceData && this.validatePriceData(priceData)) {
        this.updatePrice(priceData);
      }

    } catch (error) {
      console.error(chalk.red(`Error processing message from ${exchange}:`, error.message));
      this.emit('error', { exchange, error, message });
    }
  }

  /**
   * Validate price data
   */
  private validatePriceData(data: PriceData): boolean {
    if (!this.priceValidationEnabled) return true;

    // Basic validation
    if (data.buyPrice <= 0 || data.sellPrice <= 0) {
      console.warn(chalk.yellow(`Invalid price data from ${data.exchange}: buy=${data.buyPrice}, sell=${data.sellPrice}`));
      return false;
    }

    // Check for unrealistic spreads
    const spread = Math.abs(data.sellPrice - data.buyPrice) / data.buyPrice;
    if (spread > 0.1) { // More than 10% spread
      console.warn(chalk.yellow(`Unrealistic spread from ${data.exchange}: ${(spread * 100).toFixed(2)}%`));
      return false;
    }

    // Check for sudden price jumps
    const lastPrice = this.lastPrices.get(data.exchange);
    if (lastPrice) {
      const priceChange = Math.abs(data.buyPrice - lastPrice.buyPrice) / lastPrice.buyPrice;
      if (priceChange > 0.05) { // More than 5% change
        console.warn(chalk.yellow(`Sudden price change on ${data.exchange}: ${(priceChange * 100).toFixed(2)}%`));
        // Don't reject, but emit warning
        this.emit('priceAnomaly', { exchange: data.exchange, change: priceChange });
      }
    }

    return true;
  }

  /**
   * Update price and check for arbitrage
   */
  private updatePrice(data: PriceData) {
    this.lastPrices.set(data.exchange, data);
    this.emit('priceUpdate', data.exchange, data);
    
    // Check arbitrage opportunities
    this.checkArbitrageOpportunities();
  }

  /**
   * Check for arbitrage opportunities
   */
  private checkArbitrageOpportunities() {
    const prices = Array.from(this.lastPrices.values());
    
    if (prices.length < 2) return;

    for (let i = 0; i < prices.length; i++) {
      for (let j = i + 1; j < prices.length; j++) {
        const buyFrom = prices[i].buyPrice < prices[j].buyPrice ? prices[i] : prices[j];
        const sellTo = prices[i].sellPrice > prices[j].sellPrice ? prices[i] : prices[j];
        
        if (buyFrom.exchange !== sellTo.exchange) {
          const profit = sellTo.sellPrice - buyFrom.buyPrice;
          const profitPercent = (profit / buyFrom.buyPrice) * 100;
          
          if (profitPercent > 0.5) { // More than 0.5% profit
            this.emit('arbitrageFound', {
              buyExchange: buyFrom.exchange,
              sellExchange: sellTo.exchange,
              buyPrice: buyFrom.buyPrice,
              sellPrice: sellTo.sellPrice,
              profit,
              profitPercent,
              timestamp: Date.now()
            });
          }
        }
      }
    }
  }

  /**
   * Set up heartbeat monitoring
   */
  private setupHeartbeat(exchange: string, connection: ExchangeConnection) {
    // Clear existing heartbeat
    if (connection.heartbeatTimer) {
      clearInterval(connection.heartbeatTimer);
    }

    connection.heartbeatTimer = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - connection.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 2) {
        console.warn(chalk.yellow(`No heartbeat from ${exchange} for ${timeSinceLastHeartbeat}ms`));
        
        if (connection.ws && connection.connected) {
          connection.ws.close();
          this.scheduleReconnect(exchange, connection);
        }
      } else if (connection.ws && connection.connected) {
        // Send ping
        connection.ws.ping();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(exchange: string, connection: ExchangeConnection) {
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
    }

    if (connection.retryCount >= this.config.maxRetries) {
      console.error(chalk.red(`Max retries reached for ${exchange}. Giving up.`));
      this.emit('maxRetriesReached', exchange);
      return;
    }

    const delay = Math.min(
      this.config.retryDelay * Math.pow(this.config.reconnectBackoff, connection.retryCount),
      this.config.maxReconnectDelay
    );

    console.log(chalk.yellow(`Reconnecting to ${exchange} in ${delay}ms (attempt ${connection.retryCount + 1}/${this.config.maxRetries})`));

    connection.reconnectTimer = setTimeout(() => {
      connection.retryCount++;
      this.connectExchange(exchange, connection);
    }, delay);
  }

  /**
   * Check for stale data
   */
  private startStaleDataChecker() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [exchange, data] of this.lastPrices) {
        const age = now - data.timestamp;
        
        if (age > this.staleDataThreshold) {
          console.warn(chalk.yellow(`Stale data detected for ${exchange}: ${Math.floor(age / 1000)}s old`));
          this.emit('staleData', { exchange, age });
          
          // Try to reconnect if connection appears dead
          const connection = this.connections.get(exchange);
          if (connection && !connection.connected) {
            this.connectExchange(exchange, connection);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { [exchange: string]: boolean } {
    const status: { [exchange: string]: boolean } = {};
    
    for (const [exchange, connection] of this.connections) {
      status[exchange] = connection.connected;
    }
    
    return status;
  }

  /**
   * Get latest prices
   */
  getLatestPrices(): Map<string, PriceData> {
    return new Map(this.lastPrices);
  }

  /**
   * Force reconnect specific exchange
   */
  async reconnectExchange(exchange: string) {
    const connection = this.connections.get(exchange);
    
    if (connection) {
      console.log(chalk.blue(`Force reconnecting ${exchange}...`));
      connection.retryCount = 0;
      await this.connectExchange(exchange, connection);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConnectionConfig>) {
    this.config = { ...this.config, ...config };
    console.log(chalk.yellow('WebSocket configuration updated'));
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false;
    
    for (const [exchange, connection] of this.connections) {
      if (connection.reconnectTimer) {
        clearTimeout(connection.reconnectTimer);
      }
      
      if (connection.heartbeatTimer) {
        clearInterval(connection.heartbeatTimer);
      }
      
      if (connection.ws) {
        connection.ws.close();
      }
      
      connection.connected = false;
    }
    
    console.log(chalk.yellow('WebSocket monitor stopped'));
    this.emit('stopped');
  }
}

// Export singleton
export const enhancedPriceMonitor = new EnhancedWebSocketMonitor();