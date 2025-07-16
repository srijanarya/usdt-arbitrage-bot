import WebSocket from 'ws';
import EventEmitter from 'events';
export class WebSocketManager extends EventEmitter {
  private connections: Map<string, WebSocket> = new Map();
  
  constructor() {
    super();
  }

  connectZebPay() {
    // TODO: Complete this implementation
    console.log('ZebPay WebSocket connection - TODO');
  }
  
  connectCoinDCX() {
    // TODO: Complete this implementation
    console.log('CoinDCX WebSocket connection - TODO');
  }
  
  startAll() {
    this.connectZebPay();
    this.connectCoinDCX();
  }
  
  stopAll() {
    this.connections.forEach((ws, _exchange) => {
      ws.close();
    });
  }
}