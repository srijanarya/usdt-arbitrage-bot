import WebSocket from 'ws';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { RetryMechanism } from '../../utils/RetryMechanism';
import { errorHandler, ErrorType, ErrorSeverity } from '../../utils/errors/ErrorHandler';

interface WebSocketConfig {
  url: string;
  subscribeMessage?: any;
  heartbeatInterval?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  connectionTimeout?: number;
  messageQueue?: boolean;
  compression?: boolean;
}

interface ConnectionMetrics {
  connectedAt?: Date;
  lastMessage?: Date;
  messageCount: number;
  reconnectCount: number;
  latency: number;
  isHealthy: boolean;
}

interface QueuedMessage {
  data: any;
  timestamp: Date;
  retries: number;
}

/**
 * Optimized WebSocket manager with connection pooling, automatic failover,
 * message queuing, and intelligent reconnection strategies
 */
export class OptimizedWebSocketManager extends EventEmitter {
  private connections: Map<string, WebSocket> = new Map();
  private configs: Map<string, WebSocketConfig> = new Map();
  private metrics: Map<string, ConnectionMetrics> = new Map();
  private messageQueues: Map<string, QueuedMessage[]> = new Map();
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private pingTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Connection pool for load balancing
  private connectionPools: Map<string, string[]> = new Map();
  private currentConnectionIndex: Map<string, number> = new Map();
  
  // Circuit breaker for problematic connections
  private circuitBreakers: Map<string, { 
    failures: number; 
    lastFailure: Date; 
    isOpen: boolean 
  }> = new Map();

  private readonly defaultConfig: Partial<WebSocketConfig> = {
    reconnectDelay: 1000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
    pingInterval: 10000,
    connectionTimeout: 10000,
    messageQueue: true,
    compression: true,
  };

  constructor() {
    super();
    this.startHealthMonitoring();
  }

  /**
   * Add connection with advanced configuration
   */
  addConnection(
    name: string, 
    config: WebSocketConfig | WebSocketConfig[]
  ): void {
    if (Array.isArray(config)) {
      // Multiple URLs for load balancing/failover
      this.connectionPools.set(name, config.map(c => c.url));
      this.currentConnectionIndex.set(name, 0);
      this.configs.set(name, { ...this.defaultConfig, ...config[0] });
    } else {
      this.configs.set(name, { ...this.defaultConfig, ...config });
    }

    this.metrics.set(name, {
      messageCount: 0,
      reconnectCount: 0,
      latency: 0,
      isHealthy: false,
    });

    this.messageQueues.set(name, []);
    this.circuitBreakers.set(name, {
      failures: 0,
      lastFailure: new Date(0),
      isOpen: false,
    });
  }

  /**
   * Connect to WebSocket with optimized settings
   */
  async connect(name: string): Promise<void> {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Configuration not found for ${name}`);
    }

    // Check circuit breaker
    const breaker = this.circuitBreakers.get(name)!;
    if (breaker.isOpen && Date.now() - breaker.lastFailure.getTime() < 60000) {
      throw new Error(`Circuit breaker open for ${name}`);
    }

    const url = this.getConnectionUrl(name);
    console.log(chalk.blue(`🔌 Connecting to ${name} at ${url}...`));

    try {
      const ws = await this.createOptimizedConnection(url, config);
      this.setupConnection(name, ws, config);
      this.connections.set(name, ws);

      // Reset circuit breaker on successful connection
      breaker.failures = 0;
      breaker.isOpen = false;

      const metrics = this.metrics.get(name)!;
      metrics.connectedAt = new Date();
      metrics.isHealthy = true;

      console.log(chalk.green(`✅ Connected to ${name}`));
      this.emit('connected', name);

      // Process queued messages
      await this.processMessageQueue(name);

    } catch (error) {
      await this.handleConnectionFailure(name, error as Error);
      throw error;
    }
  }

  /**
   * Create optimized WebSocket connection
   */
  private async createOptimizedConnection(
    url: string,
    config: WebSocketConfig
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, {
        // Performance optimizations
        perMessageDeflate: config.compression ? {
          threshold: 1024,
          concurrencyLimit: 10,
          zlibDeflateOptions: {
            level: 6,
            threshold: 1024,
          },
        } : false,
        
        // Connection optimizations
        handshakeTimeout: config.connectionTimeout,
        maxPayload: 1024 * 1024, // 1MB
        skipUTF8Validation: true, // For performance, validate manually if needed
        
        // Headers for better connection handling
        headers: {
          'User-Agent': 'OptimizedArbitrageBot/1.0',
          'Connection': 'Upgrade',
          'Upgrade': 'websocket',
        },
      });

      // Connection timeout
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, config.connectionTimeout);

      ws.once('open', () => {
        clearTimeout(timeout);
        resolve(ws);
      });

      ws.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Setup connection event handlers
   */
  private setupConnection(
    name: string,
    ws: WebSocket,
    config: WebSocketConfig
  ): void {
    // Message handler with performance optimization
    ws.on('message', (data: WebSocket.Data) => {
      const startTime = process.hrtime.bigint();
      
      try {
        const message = this.parseMessage(data);
        const metrics = this.metrics.get(name)!;
        
        metrics.messageCount++;
        metrics.lastMessage = new Date();
        
        // Calculate processing latency
        const endTime = process.hrtime.bigint();
        metrics.latency = Number(endTime - startTime) / 1000000; // Convert to ms
        
        this.emit('message', name, message);
        this.emit(`${name}:message`, message);
        
      } catch (error) {
        this.emit('parseError', name, error, data);
      }
    });

    // Error handler
    ws.on('error', async (error) => {
      console.error(chalk.red(`${name} WebSocket error:`), error);
      await this.handleConnectionError(name, error);
    });

    // Close handler with intelligent reconnection
    ws.on('close', async (code, reason) => {
      console.log(chalk.yellow(`${name} connection closed: ${code} ${reason}`));
      this.cleanup(name);
      
      const shouldReconnect = this.shouldReconnect(name, code);
      if (shouldReconnect) {
        await this.scheduleReconnect(name);
      }
    });

    // Pong handler for latency measurement
    ws.on('pong', () => {
      const metrics = this.metrics.get(name)!;
      metrics.isHealthy = true;
    });

    // Setup heartbeat and ping
    this.setupHeartbeat(name, ws, config);
    this.setupPing(name, ws, config);

    // Send initial subscription message
    if (config.subscribeMessage) {
      this.sendMessage(name, config.subscribeMessage);
    }
  }

  /**
   * Send message with queuing support
   */
  sendMessage(name: string, data: any): boolean {
    const ws = this.connections.get(name);
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Queue message if connection is not ready
      const config = this.configs.get(name);
      if (config?.messageQueue) {
        const queue = this.messageQueues.get(name)!;
        queue.push({
          data,
          timestamp: new Date(),
          retries: 0,
        });
        console.log(chalk.yellow(`Queued message for ${name}`));
      }
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      ws.send(message);
      return true;
    } catch (error) {
      console.error(chalk.red(`Failed to send message to ${name}:`), error);
      return false;
    }
  }

  /**
   * Broadcast message to all connected endpoints
   */
  broadcast(data: any): number {
    let successCount = 0;
    
    for (const name of this.connections.keys()) {
      if (this.sendMessage(name, data)) {
        successCount++;
      }
    }
    
    return successCount;
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue(name: string): Promise<void> {
    const queue = this.messageQueues.get(name);
    if (!queue || queue.length === 0) return;

    const maxRetries = 3;
    const processedMessages: QueuedMessage[] = [];

    for (const queuedMessage of queue) {
      if (queuedMessage.retries >= maxRetries) {
        console.warn(chalk.yellow(`Dropping message for ${name} after ${maxRetries} retries`));
        continue;
      }

      if (this.sendMessage(name, queuedMessage.data)) {
        processedMessages.push(queuedMessage);
      } else {
        queuedMessage.retries++;
      }
    }

    // Remove processed messages
    queue.splice(0, queue.length, ...queue.filter(msg => 
      !processedMessages.includes(msg)
    ));
  }

  /**
   * Setup heartbeat mechanism
   */
  private setupHeartbeat(
    name: string,
    ws: WebSocket,
    config: WebSocketConfig
  ): void {
    if (!config.heartbeatInterval) return;

    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send custom heartbeat message if defined
        const heartbeatMessage = this.getHeartbeatMessage(name);
        if (heartbeatMessage) {
          this.sendMessage(name, heartbeatMessage);
        }
      }
    }, config.heartbeatInterval);

    this.heartbeatTimers.set(name, timer);
  }

  /**
   * Setup ping mechanism for connection health
   */
  private setupPing(
    name: string,
    ws: WebSocket,
    config: WebSocketConfig
  ): void {
    if (!config.pingInterval) return;

    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const pingStart = Date.now();
        
        ws.ping((error) => {
          if (!error) {
            const metrics = this.metrics.get(name)!;
            metrics.latency = Date.now() - pingStart;
          }
        });
      }
    }, config.pingInterval);

    this.pingTimers.set(name, timer);
  }

  /**
   * Handle connection failure with circuit breaker
   */
  private async handleConnectionFailure(name: string, error: Error): Promise<void> {
    const breaker = this.circuitBreakers.get(name)!;
    breaker.failures++;
    breaker.lastFailure = new Date();

    // Open circuit breaker after 5 failures
    if (breaker.failures >= 5) {
      breaker.isOpen = true;
      console.log(chalk.red(`Circuit breaker opened for ${name}`));
    }

    await errorHandler.handleError(error, {
      type: ErrorType.WEBSOCKET_CONNECTION,
      severity: ErrorSeverity.HIGH,
      exchange: name,
      operation: 'connect',
      data: { failures: breaker.failures },
    });

    this.emit('connectionFailure', name, error);
  }

  /**
   * Handle connection error
   */
  private async handleConnectionError(name: string, error: Error): Promise<void> {
    const metrics = this.metrics.get(name)!;
    metrics.isHealthy = false;

    await errorHandler.handleError(error, {
      type: ErrorType.WEBSOCKET_CONNECTION,
      severity: ErrorSeverity.MEDIUM,
      exchange: name,
      operation: 'runtime',
    });

    this.emit('error', name, error);
  }

  /**
   * Determine if should reconnect based on close code
   */
  private shouldReconnect(name: string, code: number): boolean {
    // Don't reconnect on normal closure or certain error codes
    const noReconnectCodes = [1000, 1001, 1002, 1003, 1011];
    if (noReconnectCodes.includes(code)) {
      return false;
    }

    const config = this.configs.get(name)!;
    const metrics = this.metrics.get(name)!;
    
    return metrics.reconnectCount < config.maxReconnectAttempts!;
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private async scheduleReconnect(name: string): Promise<void> {
    const config = this.configs.get(name)!;
    const metrics = this.metrics.get(name)!;
    
    metrics.reconnectCount++;
    
    const delay = Math.min(
      config.reconnectDelay! * Math.pow(2, metrics.reconnectCount - 1),
      60000 // Max 1 minute
    );

    console.log(chalk.yellow(
      `Reconnecting to ${name} in ${delay}ms (attempt ${metrics.reconnectCount})`
    ));

    const timer = setTimeout(async () => {
      try {
        await this.connect(name);
      } catch (error) {
        console.error(chalk.red(`Reconnection failed for ${name}:`), error);
      }
    }, delay);

    this.reconnectTimers.set(name, timer);
  }

  /**
   * Get connection URL with load balancing
   */
  private getConnectionUrl(name: string): string {
    const pools = this.connectionPools.get(name);
    if (!pools || pools.length === 0) {
      return this.configs.get(name)!.url;
    }

    // Round-robin load balancing
    const currentIndex = this.currentConnectionIndex.get(name)!;
    const url = pools[currentIndex];
    
    this.currentConnectionIndex.set(name, (currentIndex + 1) % pools.length);
    return url;
  }

  /**
   * Parse incoming message with optimization
   */
  private parseMessage(data: WebSocket.Data): any {
    try {
      const str = data.toString();
      return JSON.parse(str);
    } catch (error) {
      // Handle binary data or other formats
      return data;
    }
  }

  /**
   * Get heartbeat message for exchange
   */
  private getHeartbeatMessage(name: string): any {
    const heartbeats: Record<string, any> = {
      binance: { method: 'PING' },
      zebpay: { type: 'ping' },
      coindcx: { event: 'ping' },
    };
    
    return heartbeats[name];
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.checkConnectionHealth();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check health of all connections
   */
  private checkConnectionHealth(): void {
    for (const [name, metrics] of this.metrics) {
      const lastMessage = metrics.lastMessage;
      const isStale = lastMessage && 
        Date.now() - lastMessage.getTime() > 120000; // 2 minutes

      if (isStale) {
        console.warn(chalk.yellow(`Connection ${name} appears stale`));
        metrics.isHealthy = false;
        
        // Attempt to reconnect stale connections
        this.reconnect(name);
      }
    }
  }

  /**
   * Reconnect to specific endpoint
   */
  async reconnect(name: string): Promise<void> {
    this.disconnect(name);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.connect(name);
  }

  /**
   * Disconnect from specific endpoint
   */
  disconnect(name: string): void {
    this.cleanup(name);
    const ws = this.connections.get(name);
    
    if (ws) {
      ws.close(1000, 'Normal closure');
      this.connections.delete(name);
    }
  }

  /**
   * Disconnect from all endpoints
   */
  disconnectAll(): void {
    for (const name of this.connections.keys()) {
      this.disconnect(name);
    }
  }

  /**
   * Cleanup timers and resources
   */
  private cleanup(name: string): void {
    const heartbeatTimer = this.heartbeatTimers.get(name);
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      this.heartbeatTimers.delete(name);
    }

    const pingTimer = this.pingTimers.get(name);
    if (pingTimer) {
      clearInterval(pingTimer);
      this.pingTimers.delete(name);
    }

    const reconnectTimer = this.reconnectTimers.get(name);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      this.reconnectTimers.delete(name);
    }

    const metrics = this.metrics.get(name);
    if (metrics) {
      metrics.isHealthy = false;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [name, ws] of this.connections) {
      const metrics = this.metrics.get(name)!;
      const breaker = this.circuitBreakers.get(name)!;
      
      status[name] = {
        connected: ws.readyState === WebSocket.OPEN,
        healthy: metrics.isHealthy,
        messageCount: metrics.messageCount,
        reconnectCount: metrics.reconnectCount,
        latency: metrics.latency,
        lastMessage: metrics.lastMessage,
        circuitBreaker: {
          isOpen: breaker.isOpen,
          failures: breaker.failures,
        },
        queueSize: this.messageQueues.get(name)?.length || 0,
      };
    }
    
    return status;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    const totalMessages = Array.from(this.metrics.values())
      .reduce((sum, m) => sum + m.messageCount, 0);
    
    const avgLatency = Array.from(this.metrics.values())
      .reduce((sum, m) => sum + m.latency, 0) / this.metrics.size;

    const healthyConnections = Array.from(this.metrics.values())
      .filter(m => m.isHealthy).length;

    return {
      totalConnections: this.connections.size,
      healthyConnections,
      totalMessages,
      avgLatency: Math.round(avgLatency * 100) / 100,
      connectionHealth: healthyConnections / this.connections.size,
    };
  }
}

export const optimizedWebSocket = new OptimizedWebSocketManager();