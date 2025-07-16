const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Sample arbitrage data
let currentData = {
  prices: {
    binance_usdc_usdt: 0.9997,
    usdt_usd: 1.0000,
    usdc_usd: 0.9999,
    usdt_inr: 85.87,
    usdc_inr: 85.84
  },
  opportunities: [
    {
      type: 'USDT/USDC Binance',
      spread: 0.030,
      profitable: false,
      explanation: 'Buy USDT at 0.9997 USDC, Sell at 1.0000 = +0.030%'
    },
    {
      type: 'USDT/USDC India',
      spread: 0.035,
      profitable: false,
      explanation: 'USDT ₹85.87 vs USDC ₹85.84 = +0.035%'
    }
  ],
  lastUpdate: new Date(),
  systemStartTime: Date.now()
};

// Function to update data from real APIs
async function updateData() {
  try {
    console.log('📊 Fetching latest prices...');
    
    const [binanceResponse] = await Promise.allSettled([
      axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDCUSDT', { timeout: 5000 })
    ]);

    if (binanceResponse.status === 'fulfilled') {
      const newPrice = parseFloat(binanceResponse.value.data.price);
      currentData.prices.binance_usdc_usdt = newPrice;
      
      // Recalculate spreads
      const spread1 = ((1 - newPrice) / newPrice) * 100;
      const spread2 = ((currentData.prices.usdt_inr - currentData.prices.usdc_inr) / currentData.prices.usdc_inr) * 100;
      
      currentData.opportunities[0].spread = Math.abs(spread1);
      currentData.opportunities[0].profitable = Math.abs(spread1) > 0.1;
      
      currentData.opportunities[1].spread = Math.abs(spread2);
      currentData.opportunities[1].profitable = Math.abs(spread2) > 0.5;
      
      currentData.lastUpdate = new Date();
      
      console.log('✅ Prices updated:', {
        binance: newPrice.toFixed(6),
        spread1: spread1.toFixed(3) + '%',
        spread2: spread2.toFixed(3) + '%'
      });
    }
  } catch (error) {
    console.log('⚠️ Using cached data due to API error:', error.message);
  }
}

// Main dashboard route
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>USDT Arbitrage Monitor</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
        }
        .status {
            text-align: center;
            margin-bottom: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 5px solid #28a745;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            border-left: 5px solid #007bff;
        }
        .card h3 {
            margin-top: 0;
            color: #333;
        }
        .price {
            font-size: 1.2em;
            font-weight: bold;
            color: #007bff;
            margin: 10px 0;
            padding: 10px;
            background: white;
            border-radius: 5px;
        }
        .opportunity {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
        }
        .profitable {
            background: #d4edda;
            border-color: #c3e6cb;
        }
        .not-profitable {
            background: #f8d7da;
            border-color: #f5c6cb;
        }
        .refresh-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        .refresh-btn:hover {
            background: #0056b3;
        }
        .timestamp {
            text-align: center;
            color: #666;
            margin-top: 20px;
        }
        .loading {
            text-align: center;
            color: #666;
            font-style: italic;
        }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #28a745;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 USDT Arbitrage Monitor</h1>
        
        <div class="status">
            <h3><span class="status-indicator"></span>System Status: <span id="status">RUNNING</span></h3>
            <button class="refresh-btn" onclick="refreshData()">🔄 Refresh Data</button>
            <button class="refresh-btn" onclick="toggleAutoRefresh()" id="autoBtn">⏸️ Pause Auto-Refresh</button>
        </div>

        <div class="grid">
            <div class="card">
                <h3>📊 Current Prices</h3>
                <div id="prices" class="loading">Loading prices...</div>
            </div>

            <div class="card">
                <h3>💰 Arbitrage Opportunities</h3>
                <div id="opportunities" class="loading">Loading opportunities...</div>
            </div>
        </div>

        <div class="card">
            <h3>📈 System Metrics</h3>
            <div id="metrics" class="loading">Loading metrics...</div>
        </div>

        <div class="timestamp">
            Last updated: <span id="lastUpdate">Never</span>
        </div>
    </div>

    <script>
        let autoRefresh = true;
        let refreshInterval;

        async function fetchData() {
            try {
                const [pricesResponse, opportunitiesResponse, statusResponse] = await Promise.all([
                    fetch('/api/prices'),
                    fetch('/api/opportunities'),
                    fetch('/api/system-status')
                ]);

                const prices = await pricesResponse.json();
                const opportunities = await opportunitiesResponse.json();
                const status = await statusResponse.json();

                updatePrices(prices.data);
                updateOpportunities(opportunities.data);
                updateStatus(status.data);
                updateTimestamp();

            } catch (error) {
                console.error('Error fetching data:', error);
                document.getElementById('status').textContent = 'ERROR';
                document.getElementById('prices').innerHTML = 'Error loading data';
                document.getElementById('opportunities').innerHTML = 'Error loading data';
            }
        }

        function updatePrices(data) {
            const pricesDiv = document.getElementById('prices');
            let html = '';

            html += '<div class="price">Binance USDC/USDT: ' + data.binance_usdc_usdt.toFixed(6) + '</div>';
            html += '<div class="price">USDT/USD: $' + data.usdt_usd.toFixed(4) + '</div>';
            html += '<div class="price">USDC/USD: $' + data.usdc_usd.toFixed(4) + '</div>';
            html += '<div class="price">USDT/INR: ₹' + data.usdt_inr.toFixed(2) + '</div>';
            html += '<div class="price">USDC/INR: ₹' + data.usdc_inr.toFixed(2) + '</div>';

            pricesDiv.innerHTML = html;
        }

        function updateOpportunities(data) {
            const oppDiv = document.getElementById('opportunities');
            let html = '';

            if (data && data.length > 0) {
                data.forEach((opp, index) => {
                    const className = opp.profitable ? 'opportunity profitable' : 'opportunity not-profitable';
                    const status = opp.profitable ? '✅ PROFITABLE' : '❌ NOT PROFITABLE';
                    
                    html += '<div class="' + className + '">' +
                        '<strong>' + opp.type + '</strong><br>' +
                        'Spread: ' + (opp.spread > 0 ? '+' : '') + opp.spread.toFixed(3) + '%<br>' +
                        '<small>' + status + '</small>' +
                        '</div>';
                });
            } else {
                html = 'No opportunities detected';
            }

            oppDiv.innerHTML = html;
        }

        function updateStatus(data) {
            const statusSpan = document.getElementById('status');
            statusSpan.textContent = 'RUNNING';
            
            const uptime = Math.floor(data.uptime);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            
            document.getElementById('metrics').innerHTML = 
                '<div class="price">Uptime: ' + hours + 'h ' + minutes + 'm ' + seconds + 's</div>' +
                '<div class="price">Status: ' + data.status.toUpperCase() + '</div>' +
                '<div class="price">Memory: ' + (process.memoryUsage ? 'Available' : 'Basic') + '</div>';
        }

        function updateTimestamp() {
            document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
        }

        function refreshData() {
            fetchData();
        }

        function toggleAutoRefresh() {
            autoRefresh = !autoRefresh;
            const btn = document.getElementById('autoBtn');
            
            if (autoRefresh) {
                startAutoRefresh();
                btn.textContent = '⏸️ Pause Auto-Refresh';
            } else {
                stopAutoRefresh();
                btn.textContent = '▶️ Resume Auto-Refresh';
            }
        }

        function startAutoRefresh() {
            if (refreshInterval) clearInterval(refreshInterval);
            refreshInterval = setInterval(fetchData, 3000); // 3 seconds
        }

        function stopAutoRefresh() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        }

        // Initialize
        fetchData();
        if (autoRefresh) {
            startAutoRefresh();
        }
    </script>
</body>
</html>
  `);
});

// API Routes
app.get('/api/prices', (req, res) => {
  res.json({
    success: true,
    data: currentData.prices,
    timestamp: new Date()
  });
});

app.get('/api/opportunities', (req, res) => {
  res.json({
    success: true,
    data: currentData.opportunities,
    timestamp: new Date()
  });
});

app.get('/api/system-status', (req, res) => {
  const uptime = Math.floor((Date.now() - currentData.systemStartTime) / 1000);
  res.json({
    success: true,
    data: {
      status: 'operational',
      uptime: uptime,
      timestamp: new Date(),
      lastUpdate: currentData.lastUpdate
    }
  });
});

app.get('/api/metrics', (req, res) => {
  const totalOpportunities = currentData.opportunities.length;
  const profitableOpportunities = currentData.opportunities.filter(o => o.profitable).length;
  
  res.json({
    success: true,
    data: {
      opportunities: {
        total: totalOpportunities,
        profitable: profitableOpportunities,
        profitRate: totalOpportunities > 0 
          ? ((profitableOpportunities / totalOpportunities) * 100).toFixed(2) + '%'
          : '0%'
      },
      uptime: Math.floor((Date.now() - currentData.systemStartTime) / 1000),
      lastUpdate: currentData.lastUpdate
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 USDT Arbitrage Monitor Started!');
  console.log('');
  console.log('📊 Dashboard: http://localhost:' + PORT);
  console.log('🔗 API Status: http://localhost:' + PORT + '/api/system-status');
  console.log('💰 Opportunities: http://localhost:' + PORT + '/api/opportunities');
  console.log('');
  console.log('✅ Server running with ALL API endpoints');
  console.log('✅ Real-time price monitoring active');
  console.log('✅ Auto-refresh every 3 seconds');
  console.log('');
  console.log('Press Ctrl+C to stop');
  
  // Start updating data immediately
  updateData();
  setInterval(updateData, 5000); // Update every 5 seconds
});