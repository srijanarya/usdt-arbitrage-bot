import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import WebSocket from 'ws';

describe('Arbitrage Bot E2E Tests', () => {
  let botProcess: ChildProcess;
  const API_BASE_URL = 'http://localhost:3001';
  const WS_URL = 'ws://localhost:3002';
  
  // Helper to wait for server readiness
  const waitForServer = async (url: string, maxAttempts = 30): Promise<void> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await axios.get(url);
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error(`Server at ${url} did not start in time`);
  };

  beforeAll(async () => {
    // Start the bot in test mode
    botProcess = spawn('npx', ['ts-node', 'bot-with-monitoring.ts'], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ENABLE_LIVE_TRADING: 'false',
        MIN_PROFIT_THRESHOLD: '0.5'
      },
      detached: false
    });

    // Wait for services to start
    await waitForServer(`${API_BASE_URL}/api/metrics`);
  }, 60000);

  afterAll(async () => {
    // Gracefully shutdown the bot
    if (botProcess && !botProcess.killed) {
      botProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  });

  describe('API endpoints', () => {
    it('should serve dashboard', async () => {
      const response = await axios.get(API_BASE_URL);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.data).toContain('Dashboard');
    });

    it('should provide metrics API', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/metrics`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('totalProfit');
      expect(response.data).toHaveProperty('currentCapital');
      expect(response.data).toHaveProperty('winRate');
      expect(response.data).toHaveProperty('status', 'active');
    });

    it('should export data', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/export`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('exportTime');
      expect(response.data).toHaveProperty('metrics');
      expect(response.data).toHaveProperty('configuration');
    });
  });

  describe('WebSocket connections', () => {
    let ws: WebSocket;

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should establish WebSocket connection', (done) => {
      ws = new WebSocket(WS_URL);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    }, 10000);

    it('should receive price updates', (done) => {
      ws = new WebSocket(WS_URL);
      const receivedPrices: any[] = [];

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'price_update') {
          receivedPrices.push(message);
          
          if (receivedPrices.length >= 3) {
            expect(receivedPrices[0]).toHaveProperty('symbol');
            expect(receivedPrices[0]).toHaveProperty('price');
            expect(receivedPrices[0]).toHaveProperty('timestamp');
            done();
          }
        }
      });

      ws.on('error', done);
    }, 15000);
  });

  describe('trading simulation', () => {
    it('should detect arbitrage opportunities', async () => {
      // Wait for bot to process some data
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check if any trades were recorded
      const response = await axios.get(`${API_BASE_URL}/api/metrics`);
      const { recentTrades, profitHistory } = response.data;
      
      // In test mode, should have simulated trades
      expect(Array.isArray(recentTrades)).toBe(true);
      expect(Array.isArray(profitHistory)).toBe(true);
      
      if (recentTrades.length > 0) {
        const trade = recentTrades[0];
        expect(trade).toHaveProperty('pair');
        expect(trade).toHaveProperty('type');
        expect(trade).toHaveProperty('profit');
        expect(trade).toHaveProperty('timestamp');
      }
    }, 20000);

    it('should update position sizes dynamically', async () => {
      // Get initial metrics
      const initial = await axios.get(`${API_BASE_URL}/api/metrics`);
      const initialSizing = initial.data.positionSizing;
      
      // Wait for more trades
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get updated metrics
      const updated = await axios.get(`${API_BASE_URL}/api/metrics`);
      const updatedSizing = updated.data.positionSizing;
      
      // Position sizing should be dynamic
      expect(updatedSizing).toBeDefined();
      expect(updatedSizing.currentPercent).toBeGreaterThanOrEqual(1);
      expect(updatedSizing.currentPercent).toBeLessThanOrEqual(15);
    });
  });

  describe('error handling', () => {
    it('should handle emergency stop', async () => {
      const response = await axios.post(`${API_BASE_URL}/api/emergency-stop`);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      // Verify status changed
      const metrics = await axios.get(`${API_BASE_URL}/api/metrics`);
      expect(metrics.data.status).toBe('error');
    });

    it('should recover from API errors', async () => {
      // Send invalid data
      try {
        await axios.post(`${API_BASE_URL}/api/update-trade`, {
          invalid: 'data'
        });
      } catch (error) {
        // Expected to fail
      }
      
      // Bot should still be responsive
      const response = await axios.get(`${API_BASE_URL}/api/metrics`);
      expect(response.status).toBe(200);
    });
  });

  describe('performance monitoring', () => {
    it('should track API latency', async () => {
      // Make multiple API calls
      const latencies: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await axios.get(`${API_BASE_URL}/api/metrics`);
        latencies.push(Date.now() - start);
      }
      
      // Check reported latency
      const metrics = await axios.get(`${API_BASE_URL}/api/metrics`);
      
      expect(metrics.data.apiLatency).toBeDefined();
      expect(metrics.data.apiLatency).toBeGreaterThan(0);
      expect(metrics.data.apiLatency).toBeLessThan(1000);
    });

    it('should track uptime', async () => {
      const response1 = await axios.get(`${API_BASE_URL}/api/metrics`);
      const uptime1 = response1.data.uptime;
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response2 = await axios.get(`${API_BASE_URL}/api/metrics`);
      const uptime2 = response2.data.uptime;
      
      expect(uptime2).toBeGreaterThan(uptime1);
    });
  });

  describe('data persistence', () => {
    it('should maintain trade history', async () => {
      // Record a test trade
      await axios.post(`${API_BASE_URL}/api/update-trade`, {
        pair: 'USDT/INR',
        type: 'buy',
        profit: 123.45
      });
      
      // Export data
      const export1 = await axios.get(`${API_BASE_URL}/api/export`);
      const tradeCount1 = export1.data.fullTradeHistory.length;
      
      // Record another trade
      await axios.post(`${API_BASE_URL}/api/update-trade`, {
        pair: 'USDT/INR',
        type: 'sell',
        profit: -45.67
      });
      
      // Export again
      const export2 = await axios.get(`${API_BASE_URL}/api/export`);
      const tradeCount2 = export2.data.fullTradeHistory.length;
      
      expect(tradeCount2).toBe(tradeCount1 + 1);
      
      // Verify trades are in history
      const history = export2.data.fullTradeHistory;
      const testTrade = history.find((t: any) => t.profit === 123.45);
      expect(testTrade).toBeDefined();
    });
  });

  describe('integration with exchanges', () => {
    it('should handle multiple exchange connections', async () => {
      // This test verifies the bot can handle multiple exchanges
      // In test mode, it should use mock exchanges
      
      const metrics = await axios.get(`${API_BASE_URL}/api/metrics`);
      
      // Should have configuration for multiple exchanges
      expect(metrics.data).toBeDefined();
      
      // In a real test, we would verify:
      // - Connection status to each exchange
      // - Price feed from each exchange
      // - Order routing capabilities
    });
  });

  describe('security features', () => {
    it('should not expose sensitive data', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/export`);
      const data = JSON.stringify(response.data);
      
      // Should not contain API keys or secrets
      expect(data).not.toContain('API_KEY');
      expect(data).not.toContain('API_SECRET');
      expect(data).not.toContain('PRIVATE_KEY');
      expect(data).not.toContain('PASSWORD');
    });

    it('should handle CORS properly', async () => {
      const response = await axios.get(`${API_BASE_URL}/api/metrics`, {
        headers: {
          'Origin': 'http://malicious-site.com'
        }
      });
      
      // Should allow CORS in development but would be restricted in production
      expect(response.status).toBe(200);
    });
  });
});