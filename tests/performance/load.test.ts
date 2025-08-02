import axios from 'axios';
import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  endpoint: string;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  requestsPerSecond: number;
  errors: number;
}

class LoadTester {
  private baseUrl: string;
  private results: Map<string, number[]> = new Map();
  private errors: Map<string, number> = new Map();

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async runLoadTest(
    endpoint: string,
    requestCount: number,
    concurrency: number
  ): Promise<PerformanceMetrics> {
    const latencies: number[] = [];
    let errors = 0;
    const startTime = performance.now();

    // Create batches based on concurrency
    const batches = Math.ceil(requestCount / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchPromises = [];
      const batchSize = Math.min(concurrency, requestCount - (batch * concurrency));
      
      for (let i = 0; i < batchSize; i++) {
        batchPromises.push(this.makeRequest(endpoint, latencies, () => errors++));
      }
      
      await Promise.all(batchPromises);
    }

    const totalTime = (performance.now() - startTime) / 1000; // in seconds
    
    return {
      endpoint,
      averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minLatency: Math.min(...latencies),
      maxLatency: Math.max(...latencies),
      successRate: ((requestCount - errors) / requestCount) * 100,
      requestsPerSecond: requestCount / totalTime,
      errors
    };
  }

  private async makeRequest(
    endpoint: string,
    latencies: number[],
    onError: () => void
  ): Promise<void> {
    const start = performance.now();
    
    try {
      await axios.get(`${this.baseUrl}${endpoint}`, {
        timeout: 5000
      });
      const latency = performance.now() - start;
      latencies.push(latency);
    } catch (error) {
      onError();
    }
  }

  async stressTest(duration: number = 60000): Promise<void> {
    console.log(`Running stress test for ${duration / 1000} seconds...`);
    const startTime = Date.now();
    let totalRequests = 0;
    let totalErrors = 0;

    while (Date.now() - startTime < duration) {
      try {
        await Promise.all([
          axios.get(`${this.baseUrl}/api/metrics`),
          axios.post(`${this.baseUrl}/api/update-trade`, {
            pair: 'USDT/INR',
            type: 'buy',
            profit: Math.random() * 200 - 100
          }),
          axios.post(`${this.baseUrl}/api/update-api-latency`, {
            latency: Math.random() * 200
          })
        ]);
        totalRequests += 3;
      } catch (error) {
        totalErrors++;
      }
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    console.log(`Stress test complete:`);
    console.log(`Total requests: ${totalRequests}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Success rate: ${((totalRequests - totalErrors) / totalRequests * 100).toFixed(2)}%`);
  }
}

describe('Performance Tests', () => {
  const loadTester = new LoadTester();

  describe('API endpoint performance', () => {
    it('should handle GET /api/metrics under load', async () => {
      const metrics = await loadTester.runLoadTest('/api/metrics', 100, 10);
      
      expect(metrics.averageLatency).toBeLessThan(100); // Less than 100ms average
      expect(metrics.successRate).toBeGreaterThan(95); // 95% success rate
      expect(metrics.requestsPerSecond).toBeGreaterThan(50); // At least 50 RPS
      
      console.log('GET /api/metrics performance:', metrics);
    }, 30000);

    it('should handle POST /api/update-trade under load', async () => {
      const metrics = await loadTester.runLoadTest('/api/update-trade', 50, 5);
      
      expect(metrics.averageLatency).toBeLessThan(150);
      expect(metrics.successRate).toBeGreaterThan(90);
      
      console.log('POST /api/update-trade performance:', metrics);
    }, 30000);

    it('should handle concurrent requests to multiple endpoints', async () => {
      const endpoints = ['/api/metrics', '/api/export', '/'];
      const promises = endpoints.map(endpoint => 
        loadTester.runLoadTest(endpoint, 30, 10)
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(metric => {
        expect(metric.successRate).toBeGreaterThan(90);
        console.log(`${metric.endpoint} performance:`, metric);
      });
    }, 45000);
  });

  describe('memory and resource usage', () => {
    it('should not leak memory under sustained load', async () => {
      if (!global.gc) {
        console.log('Skipping memory test - run with --expose-gc flag');
        return;
      }

      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run load test
      await loadTester.runLoadTest('/api/metrics', 500, 20);
      
      // Force garbage collection
      global.gc();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory usage: Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
    }, 60000);
  });

  describe('WebSocket performance', () => {
    it('should handle multiple concurrent WebSocket connections', async () => {
      const WebSocket = require('ws');
      const connections: any[] = [];
      const messageCount = new Map<number, number>();
      
      // Create 50 WebSocket connections
      for (let i = 0; i < 50; i++) {
        const ws = new WebSocket('ws://localhost:3002');
        connections.push(ws);
        messageCount.set(i, 0);
        
        ws.on('message', () => {
          messageCount.set(i, (messageCount.get(i) || 0) + 1);
        });
      }
      
      // Wait for connections and messages
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check that all connections received messages
      let totalMessages = 0;
      messageCount.forEach(count => {
        totalMessages += count;
      });
      
      expect(totalMessages).toBeGreaterThan(100);
      
      // Close all connections
      connections.forEach(ws => ws.close());
      
      console.log(`WebSocket test: ${connections.length} connections, ${totalMessages} total messages`);
    }, 30000);
  });

  describe('database performance', () => {
    it('should handle rapid database operations', async () => {
      const operations = 1000;
      const start = performance.now();
      
      // Simulate rapid trade recording
      const promises = [];
      for (let i = 0; i < operations; i++) {
        promises.push(
          axios.post('http://localhost:3001/api/update-trade', {
            pair: 'USDT/INR',
            type: i % 2 === 0 ? 'buy' : 'sell',
            profit: Math.random() * 200 - 100
          })
        );
      }
      
      await Promise.all(promises);
      const duration = performance.now() - start;
      
      const opsPerSecond = (operations / duration) * 1000;
      
      expect(opsPerSecond).toBeGreaterThan(100); // At least 100 operations per second
      
      console.log(`Database performance: ${opsPerSecond.toFixed(2)} ops/second`);
    }, 30000);
  });

  describe('stress testing', () => {
    it('should remain stable under stress test', async () => {
      // Run a 30-second stress test
      await loadTester.stressTest(30000);
      
      // Verify system is still responsive
      const response = await axios.get('http://localhost:3001/api/metrics');
      expect(response.status).toBe(200);
    }, 60000);
  });

  describe('latency distribution', () => {
    it('should maintain consistent latency', async () => {
      const latencies: number[] = [];
      const requests = 200;
      
      for (let i = 0; i < requests; i++) {
        const start = performance.now();
        await axios.get('http://localhost:3001/api/metrics');
        latencies.push(performance.now() - start);
      }
      
      // Calculate percentiles
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      
      console.log(`Latency percentiles: P50=${p50.toFixed(2)}ms, P95=${p95.toFixed(2)}ms, P99=${p99.toFixed(2)}ms`);
      
      expect(p50).toBeLessThan(50);   // Median under 50ms
      expect(p95).toBeLessThan(150);  // 95th percentile under 150ms
      expect(p99).toBeLessThan(300);  // 99th percentile under 300ms
    }, 45000);
  });
});

describe('Scalability Tests', () => {
  it('should scale with increasing load', async () => {
    const loadTester = new LoadTester();
    const loads = [10, 50, 100, 200];
    const results: PerformanceMetrics[] = [];
    
    for (const load of loads) {
      const metric = await loadTester.runLoadTest('/api/metrics', load, Math.min(load, 20));
      results.push(metric);
      console.log(`Load ${load}: ${metric.averageLatency.toFixed(2)}ms avg, ${metric.requestsPerSecond.toFixed(2)} RPS`);
    }
    
    // Latency should not increase dramatically with load
    const latencyIncrease = results[results.length - 1].averageLatency / results[0].averageLatency;
    expect(latencyIncrease).toBeLessThan(3); // Less than 3x increase
  }, 120000);
});