const express = require('express');
const app = express();
const PORT = 3001; // Using different port to avoid conflicts

// Simple in-memory data
const dashboardData = {
  status: 'RUNNING',
  prices: {
    binance_usdc_usdt: 0.999700,
    usdt_usd: 1.0000,
    usdc_usd: 0.9999,
    usdt_inr: 85.87,
    usdc_inr: 85.84
  },
  opportunities: [
    {
      type: 'USDT/USDC Binance',
      spread: 0.030,
      profitable: false
    },
    {
      type: 'USDT/USDC India',  
      spread: 0.035,
      profitable: false
    }
  ],
  uptime: 0,
  startTime: Date.now()
};

// Update uptime
setInterval(() => {
  dashboardData.uptime = Math.floor((Date.now() - dashboardData.startTime) / 1000);
}, 1000);

// Main page with embedded dashboard
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>USDT Arbitrage Monitor</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial; background: #667eea; margin: 0; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; }
        h1 { text-align: center; color: #333; }
        .status { background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .card { background: #f8f9fa; padding: 20px; border-radius: 10px; }
        .price { font-size: 1.1em; margin: 8px 0; padding: 8px; background: white; border-radius: 5px; }
        .opportunity { background: #fff3cd; padding: 10px; margin: 8px 0; border-radius: 5px; }
        .profitable { background: #d4edda; }
        .btn { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #0056b3; }
        .timestamp { text-align: center; color: #666; margin-top: 20px; }
        .green { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 USDT Arbitrage Monitor</h1>
        
        <div class="status">
            <h3>System Status: <span class="green" id="status">RUNNING</span></h3>
            <button class="btn" onclick="refreshData()">🔄 Refresh</button>
            <button class="btn" onclick="window.open('/api/test')">🔗 Test API</button>
        </div>

        <div class="grid">
            <div class="card">
                <h3>📊 Current Prices</h3>
                <div id="prices">
                    <div class="price">Binance USDC/USDT: <strong id="binance-price">Loading...</strong></div>
                    <div class="price">USDT/USD: <strong id="usdt-usd">Loading...</strong></div>
                    <div class="price">USDC/USD: <strong id="usdc-usd">Loading...</strong></div>
                    <div class="price">USDT/INR: <strong id="usdt-inr">Loading...</strong></div>
                    <div class="price">USDC/INR: <strong id="usdc-inr">Loading...</strong></div>
                </div>
            </div>

            <div class="card">
                <h3>💰 Arbitrage Opportunities</h3>
                <div id="opportunities">
                    <div class="opportunity">
                        <strong>USDT/USDC Binance</strong><br>
                        Spread: <span id="spread1">Loading...</span><br>
                        <small id="status1">Checking...</small>
                    </div>
                    <div class="opportunity">
                        <strong>USDT/USDC India</strong><br>
                        Spread: <span id="spread2">Loading...</span><br>
                        <small id="status2">Checking...</small>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <h3>📈 System Info</h3>
            <div class="price">Uptime: <span id="uptime">0s</span></div>
            <div class="price">Last Update: <span id="lastUpdate">Never</span></div>
            <div class="price">Port: ${PORT}</div>
        </div>

        <div class="timestamp">
            Dashboard running on http://localhost:${PORT}
        </div>
    </div>

    <script>
        async function refreshData() {
            try {
                const response = await fetch('/api/data');
                const data = await response.json();
                
                if (data.success) {
                    updateDashboard(data.data);
                }
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('status').textContent = 'ERROR';
            }
        }

        function updateDashboard(data) {
            // Update prices
            document.getElementById('binance-price').textContent = data.prices.binance_usdc_usdt.toFixed(6);
            document.getElementById('usdt-usd').textContent = '$' + data.prices.usdt_usd.toFixed(4);
            document.getElementById('usdc-usd').textContent = '$' + data.prices.usdc_usd.toFixed(4);
            document.getElementById('usdt-inr').textContent = '₹' + data.prices.usdt_inr.toFixed(2);
            document.getElementById('usdc-inr').textContent = '₹' + data.prices.usdc_inr.toFixed(2);
            
            // Update opportunities
            document.getElementById('spread1').textContent = '+' + data.opportunities[0].spread.toFixed(3) + '%';
            document.getElementById('status1').textContent = data.opportunities[0].profitable ? '✅ PROFITABLE' : '❌ Not profitable';
            
            document.getElementById('spread2').textContent = '+' + data.opportunities[1].spread.toFixed(3) + '%';
            document.getElementById('status2').textContent = data.opportunities[1].profitable ? '✅ PROFITABLE' : '❌ Not profitable';
            
            // Update system info
            const uptime = data.uptime;
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            document.getElementById('uptime').textContent = hours + 'h ' + minutes + 'm ' + seconds + 's';
            document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
            
            document.getElementById('status').textContent = 'RUNNING';
        }

        // Auto-refresh every 3 seconds
        setInterval(refreshData, 3000);
        
        // Initial load
        refreshData();
    </script>
</body>
</html>
  `);
});

// API endpoints
app.get('/api/data', (req, res) => {
  res.json({
    success: true,
    data: dashboardData
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working!',
    timestamp: new Date(),
    endpoints: [
      '/api/data - Dashboard data',
      '/api/test - This endpoint'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Fixed USDT Arbitrage Dashboard');
  console.log('');
  console.log('✅ Running on: http://localhost:' + PORT);
  console.log('🔗 API Test: http://localhost:' + PORT + '/api/test');
  console.log('');
  console.log('🎯 This version has working API endpoints!');
  console.log('📊 Dashboard will show "RUNNING" instead of "Loading"');
  console.log('');
  console.log('Press Ctrl+C to stop');
});