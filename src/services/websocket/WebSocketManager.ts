import WebSocket from 'ws';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import { PostgresService } from '../database/postgresService';

interface PriceUpdate {
  exchange: string;
  symbol: string;
  bid: number;
  ask: number;
  timestamp: Date;
}

export class WebSocketManager extends EventEmitter {
  private connections: Map<string, WebSocket> = new Map();
  private reconnectIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor() {
    super();
    this.setMaxListeners(20); // Increase for multiple exchanges
  }

  // Start all WebSocket connections
  async start() {
    console.log(chalk.cyan('🚀 Starting WebSocket connections...\n'));
    this.isRunning = true;

    // Connect to all exchanges
    this.connectBinance();
    this.connectZebPay();
    this.connectCoinDCX();
    this.connectKuCoin();
  }

  // Stop all connections
  stop() {
    console.log(chalk.yellow('🛑 Stopping WebSocket connections...'));
    this.isRunning = false;

    // Close all connections
    this.connections.forEach((ws, exchange) => {
      ws.close();
      console.log(chalk.gray(`Closed ${exchange} connection`));
    });

    // Clear reconnect intervals
    this.reconnectIntervals.forEach(interval => clearInterval(interval));
    this.reconnectIntervals.clear();
    this.connections.clear();
  }

  // Connect to Binance WebSocket
  private connectBinance() {
    const exchange = 'binance';
    const symbol = 'usdtinr'; // Binance uses lowercase
    const url = `wss://stream.binance.com:9443/ws/${symbol}@bookTicker`;

    console.log(chalk.yellow(`📡 Connecting to Binance WebSocket...`));

    const ws = new WebSocket(url);
    this.connections.set(exchange, ws);

    ws.on('open', () => {
      console.log(chalk.green(`✅ Binance WebSocket connected`));
    });

    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const json = JSON.parse(data.toString());
        const priceUpdate: PriceUpdate = {
          exchange,
          symbol: 'USDT/INR',
          bid: parseFloat(json.b), // Best bid price
          ask: parseFloat(json.a), // Best ask price
          timestamp: new Date()
        };

        // Emit price update
        this.emit('priceUpdate', priceUpdate);

        // Save to database
        await PostgresService.savePriceData(
          priceUpdate.exchange,
          priceUpdate.symbol,
          priceUpdate.bid,
          priceUpdate.ask
        );

      } catch (error) {
        console.error(chalk.red(`Binance parse error: ${error.message}`));
      }
    });

    ws.on('error', (error) => {
      console.error(chalk.red(`Binance WebSocket error: ${error.message}`));
    });

    ws.on('close', () => {
      console.log(chalk.yellow(`Binance WebSocket closed`));
      if (this.isRunning) {
        this.scheduleReconnect(exchange, () => this.connectBinance());
      }
    });
  }

  // Connect to ZebPay WebSocket
  private connectZebPay() {
    const exchange = 'zebpay';
    const url = 'wss://ws-api.zebpay.com/marketdata';

    console.log(chalk.yellow(`📡 Connecting to ZebPay WebSocket...`));

    const ws = new WebSocket(url);
    this.connections.set(exchange, ws);

    ws.on('open', () => {
      console.log(chalk.green(`✅ ZebPay WebSocket connected`));
      
      // Subscribe to USDT-INR ticker
      ws.send(JSON.stringify({
        "event": "subscribe",
        "channel": "ticker",
        "pair": ["USDT-INR"]
      }));
    });

    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const json = JSON.parse(data.toString());
        
        if (json.event === 'ticker' && json.pair === 'USDT-INR') {
          const priceUpdate: PriceUpdate = {
            exchange,
            symbol: 'USDT/INR',
            bid: parseFloat(json.buy),
            ask: parseFloat(json.sell),
            timestamp: new Date()
          };

          this.emit('priceUpdate', priceUpdate);

          await PostgresService.savePriceData(
            priceUpdate.exchange,
            priceUpdate.symbol,
            priceUpdate.bid,
            priceUpdate.ask
          );
        }
      } catch (error) {
        console.error(chalk.red(`ZebPay parse error: ${error.message}`));
      }
    });

    ws.on('error', (error) => {
      console.error(chalk.red(`ZebPay WebSocket error: ${error.message}`));
    });

    ws.on('close', () => {
      console.log(chalk.yellow(`ZebPay WebSocket closed`));
      if (this.isRunning) {
        this.scheduleReconnect(exchange, () => this.connectZebPay());
      }
    });
  }

  // Connect to CoinDCX WebSocket
  private connectCoinDCX() {
    const exchange = 'coindcx';
    const url = 'wss://stream.coindcx.com';

    console.log(chalk.yellow(`📡 Connecting to CoinDCX WebSocket...`));

    const ws = new WebSocket(url);
    this.connections.set(exchange, ws);

    ws.on('open', () => {
      console.log(chalk.green(`✅ CoinDCX WebSocket connected`));
      
      // Subscribe to USDTINR market data
      ws.send(JSON.stringify({
        "channelName": "ticker",
        "marketPair": ["I-USDT_INR"]
      }));
    });

    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const json = JSON.parse(data.toString());
        
        if (json.event === 'ticker-update' && json.marketPair === 'I-USDT_INR') {
          const priceUpdate: PriceUpdate = {
            exchange,
            symbol: 'USDT/INR',
            bid: parseFloat(json.data.bid),
            ask: parseFloat(json.data.ask),
            timestamp: new Date()
          };

          this.emit('priceUpdate', priceUpdate);

          await PostgresService.savePriceData(
            priceUpdate.exchange,
            priceUpdate.symbol,
            priceUpdate.bid,
            priceUpdate.ask
          );
        }
      } catch (error) {
        console.error(chalk.red(`CoinDCX parse error: ${error.message}`));
      }
    });

    ws.on('error', (error) => {
      console.error(chalk.red(`CoinDCX WebSocket error: ${error.message}`));
    });

    ws.on('close', () => {
      console.log(chalk.yellow(`CoinDCX WebSocket closed`));
      if (this.isRunning) {
        this.scheduleReconnect(exchange, () => this.connectCoinDCX());
      }
    });
  }

  // Connect to KuCoin WebSocket
  private connectKuCoin() {
    const exchange = 'kucoin';
    const symbol = 'USDT-USDC';
    const url = 'wss://ws-api-spot.kucoin.com/';

    console.log(chalk.yellow(`📡 Connecting to KuCoin WebSocket...`));

    const ws = new WebSocket(url);
    this.connections.set(exchange, ws);

    ws.on('open', () => {
      console.log(chalk.green(`✅ KuCoin WebSocket connected`));
      
      // Subscribe to ticker
      ws.send(JSON.stringify({
        "id": Date.now(),
        "type": "subscribe",
        "topic": `/market/ticker:${symbol}`,
        "response": true
      }));
    });

    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const json = JSON.parse(data.toString());
        
        if (json.type === 'message' && json.topic === `/market/ticker:${symbol}`) {
          const priceUpdate: PriceUpdate = {
            exchange,
            symbol: 'USDT/USDC',
            bid: parseFloat(json.data.bestBid),
            ask: parseFloat(json.data.bestAsk),
            timestamp: new Date()
          };

          this.emit('priceUpdate', priceUpdate);

          await PostgresService.savePriceData(
            priceUpdate.exchange,
            priceUpdate.symbol,
            priceUpdate.bid,
            priceUpdate.ask
          );
        }
      } catch (error) {
        console.error(chalk.red(`KuCoin parse error: ${error.message}`));
      }
    });

    ws.on('error', (error) => {
      console.error(chalk.red(`KuCoin WebSocket error: ${error.message}`));
    });

    ws.on('close', () => {
      console.log(chalk.yellow(`KuCoin WebSocket closed`));
      if (this.isRunning) {
        this.scheduleReconnect(exchange, () => this.connectKuCoin());
      }
    });

    // KuCoin requires ping/pong
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          "id": Date.now(),
          "type": "ping"
        }));
      }
    }, 30000);

    ws.on('close', () => clearInterval(pingInterval));
  }

  // Schedule reconnection
  private scheduleReconnect(exchange: string, connectFn: () => void) {
    console.log(chalk.yellow(`⏳ Scheduling reconnect for ${exchange} in 5 seconds...`));
    
    const timeout = setTimeout(() => {
      console.log(chalk.cyan(`🔄 Reconnecting to ${exchange}...`));
      connectFn();
    }, 5000);

    this.reconnectIntervals.set(exchange, timeout);
  }

  // Get current prices from all exchanges
  getCurrentPrices(): Map<string, PriceUpdate> {
    const prices = new Map<string, PriceUpdate>();
    
    // This would be populated by the real-time updates
    // For now, return empty map
    return prices;
  }

  // Check connection status
  getConnectionStatus(): Map<string, boolean> {
    const status = new Map<string, boolean>();
    
    this.connections.forEach((ws, exchange) => {
      status.set(exchange, ws.readyState === WebSocket.OPEN);
    });

    return status;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();