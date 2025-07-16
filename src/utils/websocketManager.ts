import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from './logger';

export interface WebSocketConfig {
  url: string;
  name: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  requestTimeout: number;
  pingInterval: number;
  maxPingFailures: number;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
}

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timer;
  private heartbeatTimer?: NodeJS.Timer;
  private pingTimer?: NodeJS.Timer;
  private pingFailures = 0;
  private isIntentionallyClosed = false;
  private messageQueue: any[] = [];
  private lastPongTime: number = Date.now();
  private connectionStartTime?: number;

  constructor(config: Partial<WebSocketConfig>) {
    super();
    
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      requestTimeout: 10000,
      pingInterval: 20000,
      maxPingFailures: 3,
      ...config
    } as WebSocketConfig;

    if (!this.config.url || !this.config.name) {
      throw new Error('WebSocket URL and name are required');
    }
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.warn(`[${this.config.name}] WebSocket already connected`);
      return;
    }

    this.isIntentionallyClosed = false;
    this.connectionStartTime = Date.now();
    
    try {
      logger.info(`[${this.config.name}] Connecting to WebSocket: ${this.config.url}`);
      
      this.ws = new WebSocket(this.config.url, {
        headers: {
          'User-Agent': 'USDT-Arbitrage-Bot/1.0'
        },
        handshakeTimeout: 10000
      });

      this.setupEventHandlers();
      
    } catch (error) {
      logger.error(`[${this.config.name}] WebSocket connection error:`, error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      logger.info(`[${this.config.name}] WebSocket connected`);
      this.reconnectAttempts = 0;
      this.pingFailures = 0;
      this.lastPongTime = Date.now();
      
      // Clear any pending reconnect
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }

      // Send queued messages
      this.flushMessageQueue();
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Start ping monitoring
      this.startPingMonitoring();
      
      this.emit('connected', {
        name: this.config.name,
        connectionTime: Date.now() - (this.connectionStartTime || 0)
      });
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = this.parseMessage(data);
        
        // Handle pong messages
        if (message.type === 'pong' || message.method === 'pong') {
          this.handlePong();
          return;
        }
        
        this.emit('message', message);
        
        // Emit specific event types
        if (message.type) {
          this.emit(message.type, message.data);
        }
        
      } catch (error) {
        logger.error(`[${this.config.name}] Error parsing message:`, error);
        this.emit('error', error);
      }
    });

    this.ws.on('error', (error: Error) => {
      logger.error(`[${this.config.name}] WebSocket error:`, error);
      this.emit('error', error);
    });

    this.ws.on('close', (code: number, reason: string) => {
      logger.info(`[${this.config.name}] WebSocket closed - Code: ${code}, Reason: ${reason}`);
      
      this.stopHeartbeat();
      this.stopPingMonitoring();
      
      this.emit('disconnected', { code, reason });
      
      if (!this.isIntentionallyClosed) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('ping', () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.pong();
      }
    });

    this.ws.on('pong', () => {
      this.handlePong();
    });
  }

  private parseMessage(data: WebSocket.Data): WebSocketMessage {
    let parsed: any;
    
    if (typeof data === 'string') {
      parsed = JSON.parse(data);
    } else if (data instanceof Buffer) {
      parsed = JSON.parse(data.toString());
    } else {
      throw new Error('Unknown message format');
    }
    
    return {
      type: parsed.type || parsed.event || parsed.method || 'unknown',
      data: parsed.data || parsed.result || parsed,
      timestamp: new Date()
    };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat = {
          type: 'heartbeat',
          timestamp: Date.now()
        };
        
        try {
          this.ws.send(JSON.stringify(heartbeat));
          this.emit('heartbeat', heartbeat);
        } catch (error) {
          logger.error(`[${this.config.name}] Heartbeat error:`, error);
        }
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private startPingMonitoring(): void {
    this.stopPingMonitoring();
    
    this.pingTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      
      const timeSinceLastPong = Date.now() - this.lastPongTime;
      
      // Check if we haven't received a pong in too long
      if (timeSinceLastPong > this.config.pingInterval * 2) {
        this.pingFailures++;
        logger.warn(`[${this.config.name}] Ping failure ${this.pingFailures}/${this.config.maxPingFailures}`);
        
        if (this.pingFailures >= this.config.maxPingFailures) {
          logger.error(`[${this.config.name}] Max ping failures reached, reconnecting...`);
          this.reconnect();
          return;
        }
      }
      
      // Send ping
      try {
        this.ws.ping();
      } catch (error) {
        logger.error(`[${this.config.name}] Ping error:`, error);
      }
    }, this.config.pingInterval);
  }

  private stopPingMonitoring(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  private handlePong(): void {
    this.lastPongTime = Date.now();
    this.pingFailures = 0;
    this.emit('pong', { latency: Date.now() - this.lastPongTime });
  }

  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed) return;
    
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error(`[${this.config.name}] Max reconnection attempts reached`);
      this.emit('maxReconnectAttemptsReached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      60000 // Max 1 minute
    );
    
    logger.info(`[${this.config.name}] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      try {
        this.send(message);
      } catch (error) {
        logger.error(`[${this.config.name}] Error sending queued message:`, error);
      }
    }
  }

  send(data: any): void {
    if (!this.isConnected()) {
      logger.warn(`[${this.config.name}] WebSocket not connected, queueing message`);
      this.messageQueue.push(data);
      
      // Limit queue size
      if (this.messageQueue.length > 100) {
        this.messageQueue.shift();
      }
      
      return;
    }
    
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws!.send(message);
      this.emit('sent', data);
    } catch (error) {
      logger.error(`[${this.config.name}] Send error:`, error);
      throw error;
    }
  }

  async sendAndWait(data: any, responseType: string, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutMs = timeout || this.config.requestTimeout;
      let timeoutHandle: NodeJS.Timer;
      
      const responseHandler = (response: any) => {
        clearTimeout(timeoutHandle);
        this.removeListener(responseType, responseHandler);
        resolve(response);
      };
      
      timeoutHandle = setTimeout(() => {
        this.removeListener(responseType, responseHandler);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      
      this.once(responseType, responseHandler);
      
      try {
        this.send(data);
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.removeListener(responseType, responseHandler);
        reject(error);
      }
    });
  }

  reconnect(): void {
    logger.info(`[${this.config.name}] Manual reconnect requested`);
    this.disconnect();
    this.connect();
  }

  disconnect(): void {
    logger.info(`[${this.config.name}] Disconnecting WebSocket`);
    
    this.isIntentionallyClosed = true;
    
    // Clear timers
    this.stopHeartbeat();
    this.stopPingMonitoring();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnect');
      } catch (error) {
        logger.error(`[${this.config.name}] Error closing WebSocket:`, error);
      }
      this.ws = null;
    }
    
    // Clear message queue
    this.messageQueue = [];
    
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }

  getStats(): {
    state: string;
    reconnectAttempts: number;
    pingFailures: number;
    queuedMessages: number;
    lastPongTime: Date;
    uptime: number;
  } {
    return {
      state: this.getState(),
      reconnectAttempts: this.reconnectAttempts,
      pingFailures: this.pingFailures,
      queuedMessages: this.messageQueue.length,
      lastPongTime: new Date(this.lastPongTime),
      uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0
    };
  }

  setMaxReconnectAttempts(attempts: number): void {
    this.config.maxReconnectAttempts = attempts;
  }

  setReconnectInterval(interval: number): void {
    this.config.reconnectInterval = interval;
  }

  clearMessageQueue(): void {
    this.messageQueue = [];
  }
}