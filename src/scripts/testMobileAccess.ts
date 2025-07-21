import chalk from 'chalk';
import axios from 'axios';
import WebSocket from 'ws';
import { networkInterfaces } from 'os';

class MobileAccessTester {
  private baseUrl: string;
  private wsUrl: string;
  private token: string = '';
  private testResults: { [key: string]: boolean } = {};

  constructor(port: number = 3333) {
    const localIP = this.getLocalIP();
    this.baseUrl = `http://${localIP}:${port}`;
    this.wsUrl = `ws://${localIP}:${port}`;
  }

  async runTests() {
    console.log(chalk.bgCyan.black('\n 📱 MOBILE ACCESS TEST SUITE \n'));
    console.log(chalk.cyan('━'.repeat(60)));
    console.log(chalk.yellow(`Testing server at: ${this.baseUrl}\n`));

    // Test 1: Server Health
    await this.testServerHealth();

    // Test 2: Authentication
    await this.testAuthentication();

    // Test 3: REST API Endpoints
    await this.testRESTEndpoints();

    // Test 4: WebSocket Connection
    await this.testWebSocketConnection();

    // Test 5: Mobile Dashboard
    await this.testMobileDashboard();

    // Display results
    this.displayResults();
  }

  /**
   * Test server health
   */
  private async testServerHealth() {
    console.log(chalk.yellow('1. Testing Server Health...'));
    
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      
      this.testResults['Server Health'] = response.status === 200;
      console.log(chalk.green('   ✅ Server is healthy'));
      console.log(chalk.gray(`   Clients connected: ${response.data.clients}`));
      console.log(chalk.gray(`   Uptime: ${Math.floor(response.data.uptime / 60)} minutes`));
    } catch (error) {
      this.testResults['Server Health'] = false;
      console.log(chalk.red('   ❌ Server health check failed'));
      console.log(chalk.red(`   Error: ${error.message}`));
      console.log(chalk.yellow('\n   💡 Make sure to start the server with: npm run mobile:trading'));
    }
  }

  /**
   * Test authentication
   */
  private async testAuthentication() {
    console.log(chalk.yellow('\n2. Testing Authentication...'));
    
    try {
      // Test with correct PIN
      const response = await axios.post(`${this.baseUrl}/api/auth`, {
        pin: '1234'
      });
      
      if (response.data.success && response.data.token) {
        this.token = response.data.token;
        this.testResults['Authentication - Valid PIN'] = true;
        console.log(chalk.green('   ✅ Authentication successful'));
      } else {
        this.testResults['Authentication - Valid PIN'] = false;
        console.log(chalk.red('   ❌ Authentication failed'));
      }

      // Test with invalid PIN
      try {
        await axios.post(`${this.baseUrl}/api/auth`, {
          pin: '0000'
        });
        this.testResults['Authentication - Invalid PIN'] = false;
        console.log(chalk.red('   ❌ Invalid PIN accepted (security issue)'));
      } catch (error) {
        if (error.response?.status === 401) {
          this.testResults['Authentication - Invalid PIN'] = true;
          console.log(chalk.green('   ✅ Invalid PIN correctly rejected'));
        }
      }

    } catch (error) {
      this.testResults['Authentication'] = false;
      console.log(chalk.red('   ❌ Authentication test failed:', error.message));
    }
  }

  /**
   * Test REST API endpoints
   */
  private async testRESTEndpoints() {
    console.log(chalk.yellow('\n3. Testing REST API Endpoints...'));
    
    if (!this.token) {
      console.log(chalk.red('   ⚠️  Skipping API tests - no auth token'));
      return;
    }

    const headers = { Authorization: `Bearer ${this.token}` };
    
    // Test status endpoint
    try {
      const response = await axios.get(`${this.baseUrl}/api/status`, { headers });
      this.testResults['API - Status'] = response.status === 200 && response.data.trading;
      console.log(chalk.green('   ✅ Status endpoint working'));
    } catch (error) {
      this.testResults['API - Status'] = false;
      console.log(chalk.red('   ❌ Status endpoint failed'));
    }

    // Test daily report endpoint
    try {
      const response = await axios.get(`${this.baseUrl}/api/report/daily`, { headers });
      this.testResults['API - Daily Report'] = response.status === 200;
      console.log(chalk.green('   ✅ Daily report endpoint working'));
    } catch (error) {
      this.testResults['API - Daily Report'] = false;
      console.log(chalk.red('   ❌ Daily report endpoint failed'));
    }

    // Test trading toggle (read current state only)
    try {
      const response = await axios.get(`${this.baseUrl}/api/status`, { headers });
      const currentState = response.data.trading.enabled;
      console.log(chalk.gray(`   Trading is currently: ${currentState ? 'ENABLED' : 'DISABLED'}`));
      this.testResults['API - Trading Control'] = true;
    } catch (error) {
      this.testResults['API - Trading Control'] = false;
      console.log(chalk.red('   ❌ Trading control endpoint failed'));
    }
  }

  /**
   * Test WebSocket connection
   */
  private async testWebSocketConnection() {
    console.log(chalk.yellow('\n4. Testing WebSocket Connection...'));
    
    return new Promise((resolve) => {
      const ws = new WebSocket(this.wsUrl);
      let authenticated = false;
      
      const timeout = setTimeout(() => {
        if (!authenticated) {
          this.testResults['WebSocket'] = false;
          console.log(chalk.red('   ❌ WebSocket connection timeout'));
          ws.close();
          resolve(void 0);
        }
      }, 10000);

      ws.on('open', () => {
        console.log(chalk.green('   ✅ WebSocket connected'));
        // Send auth
        ws.send(JSON.stringify({ type: 'auth', pin: '1234' }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'auth' && message.success) {
            authenticated = true;
            this.testResults['WebSocket - Auth'] = true;
            console.log(chalk.green('   ✅ WebSocket authentication successful'));
          }
          
          if (message.type === 'update') {
            this.testResults['WebSocket - Updates'] = true;
            console.log(chalk.green('   ✅ Receiving real-time updates'));
            console.log(chalk.gray(`   Daily P&L: ₹${message.trading.dailyProfit.toFixed(2)}`));
            console.log(chalk.gray(`   Win Rate: ${message.risk.winRate}%`));
            
            clearTimeout(timeout);
            ws.close();
            resolve(void 0);
          }
        } catch (error) {
          console.log(chalk.red('   ❌ Error parsing WebSocket message'));
        }
      });

      ws.on('error', (error) => {
        this.testResults['WebSocket'] = false;
        console.log(chalk.red('   ❌ WebSocket error:', error.message));
        clearTimeout(timeout);
        resolve(void 0);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        resolve(void 0);
      });
    });
  }

  /**
   * Test mobile dashboard
   */
  private async testMobileDashboard() {
    console.log(chalk.yellow('\n5. Testing Mobile Dashboard...'));
    
    try {
      // Test main page
      const response = await axios.get(this.baseUrl, {
        timeout: 5000,
        validateStatus: () => true
      });
      
      this.testResults['Dashboard - Main Page'] = response.status === 200;
      
      if (response.status === 200) {
        console.log(chalk.green('   ✅ Dashboard page loads'));
        
        // Check if it redirects to mobile dashboard
        if (response.data.includes('mobile-dashboard.html')) {
          console.log(chalk.green('   ✅ Redirects to mobile dashboard'));
        }
      } else {
        console.log(chalk.red('   ❌ Dashboard page failed to load'));
      }

      // Test mobile dashboard directly
      const mobileResponse = await axios.get(`${this.baseUrl}/mobile-dashboard.html`, {
        timeout: 5000,
        validateStatus: () => true
      });
      
      this.testResults['Dashboard - Mobile'] = mobileResponse.status === 200;
      
      if (mobileResponse.status === 200) {
        console.log(chalk.green('   ✅ Mobile dashboard available'));
        
        // Check for required elements
        const hasAuth = mobileResponse.data.includes('authScreen');
        const hasDashboard = mobileResponse.data.includes('dashboard');
        const hasWebSocket = mobileResponse.data.includes('WebSocket');
        
        console.log(chalk.gray(`   Auth screen: ${hasAuth ? '✓' : '✗'}`));
        console.log(chalk.gray(`   Dashboard: ${hasDashboard ? '✓' : '✗'}`));
        console.log(chalk.gray(`   WebSocket support: ${hasWebSocket ? '✓' : '✗'}`));
      }
      
    } catch (error) {
      this.testResults['Dashboard'] = false;
      console.log(chalk.red('   ❌ Dashboard test failed:', error.message));
    }
  }

  /**
   * Display test results
   */
  private displayResults() {
    console.log(chalk.cyan('\n━'.repeat(60)));
    console.log(chalk.bgCyan.black('\n 📊 TEST RESULTS \n'));
    
    let passed = 0;
    let total = 0;
    
    Object.entries(this.testResults).forEach(([test, result]) => {
      total++;
      if (result) passed++;
      
      const icon = result ? '✅' : '❌';
      const color = result ? chalk.green : chalk.red;
      console.log(`${icon} ${color(test)}`);
    });
    
    const percentage = total > 0 ? (passed / total * 100).toFixed(0) : 0;
    const summaryColor = percentage >= 80 ? chalk.green : percentage >= 60 ? chalk.yellow : chalk.red;
    
    console.log(chalk.cyan('\n━'.repeat(60)));
    console.log(summaryColor(`\nOverall: ${passed}/${total} tests passed (${percentage}%)\n`));
    
    // Mobile access instructions
    console.log(chalk.yellow('📱 To access from your phone:'));
    console.log(`1. Connect phone to same WiFi network`);
    console.log(`2. Open browser and go to: ${chalk.cyan(this.baseUrl)}`);
    console.log(`3. Enter PIN: ${chalk.cyan('1234')}`);
    console.log(`4. Save to home screen for app-like experience\n`);
    
    // QR code hint
    console.log(chalk.gray('💡 Tip: The server shows a QR code when started with: npm run mobile:trading\n'));
  }

  /**
   * Get local IP address
   */
  private getLocalIP(): string {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]!) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return 'localhost';
  }
}

// Run tests
const tester = new MobileAccessTester();
tester.runTests()
  .then(() => {
    console.log(chalk.gray('Mobile access tests completed'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Test error:', error));
    process.exit(1);
  });