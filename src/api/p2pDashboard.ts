import express from 'express';
import axios from 'axios';
import path from 'path';
import { WebSocketServer } from 'ws';
import http from 'http';

const app = express();
const PORT = 3005;

// Create HTTP server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files
app.use(express.static('public'));

// Store connected clients
const clients = new Set<any>();

// P2P data cache
let p2pCache = {
    buyers: [],
    sellers: [],
    lastUpdate: null,
    userPaymentMethods: ['UPI', 'BankIndia', 'IMPS']
};

// WebSocket connection
wss.on('connection', (ws) => {
    clients.add(ws);
    
    // Send current data to new client
    ws.send(JSON.stringify({
        type: 'initial',
        data: p2pCache
    }));
    
    ws.on('close', () => {
        clients.delete(ws);
    });
});

// Broadcast to all clients
function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(message);
        }
    });
}

// Fetch P2P data
async function fetchP2PData() {
    try {
        // Fetch buyers (you sell to them)
        const buyersResponse = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            page: 1,
            rows: 20,
            asset: 'USDT',
            fiat: 'INR',
            tradeType: 'BUY',
            payTypes: []
        });
        
        // Fetch sellers (you buy from them)
        const sellersResponse = await axios.post('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            page: 1,
            rows: 20,
            asset: 'USDT',
            fiat: 'INR',
            tradeType: 'SELL',
            payTypes: []
        });
        
        const buyers = buyersResponse.data.data || [];
        const sellers = sellersResponse.data.data || [];
        
        // Process and enhance data
        const processMerchant = (ad: any, type: string) => {
            const methods = ad.adv.tradeMethods.map((m: any) => m.identifier || m.tradeMethodName);
            const compatible = methods.some((method: string) => 
                p2pCache.userPaymentMethods.includes(method) ||
                (method === 'Bank Transfer' && p2pCache.userPaymentMethods.includes('BankIndia'))
            );
            
            return {
                id: ad.advertiser.userNo,
                name: ad.advertiser.nickName,
                price: parseFloat(ad.adv.price),
                minLimit: parseFloat(ad.adv.minSingleTransAmount),
                maxLimit: parseFloat(ad.adv.maxSingleTransAmount),
                minUSDT: parseFloat(ad.adv.minSingleTransAmount) / parseFloat(ad.adv.price),
                maxUSDT: parseFloat(ad.adv.maxSingleTransAmount) / parseFloat(ad.adv.price),
                available: parseFloat(ad.adv.surplusAmount),
                paymentMethods: methods,
                compatible: compatible,
                orders30d: ad.advertiser.monthOrderCount,
                completionRate: parseFloat(ad.advertiser.monthFinishRate),
                avgReleaseTime: ad.adv.avgReleaseTime || 'N/A',
                type: type,
                online: ad.advertiser.isOnline,
                remarks: ad.adv.remarks || ''
            };
        };
        
        p2pCache = {
            buyers: buyers.map((ad: any) => processMerchant(ad, 'buy')),
            sellers: sellers.map((ad: any) => processMerchant(ad, 'sell')),
            lastUpdate: new Date(),
            userPaymentMethods: p2pCache.userPaymentMethods
        };
        
        // Calculate arbitrage opportunities
        const opportunities = [];
        p2pCache.sellers.forEach(seller => {
            p2pCache.buyers.forEach(buyer => {
                if (seller.compatible && buyer.compatible && buyer.price > seller.price) {
                    const amount = 100; // Calculate for 100 USDT
                    const profit = (buyer.price - seller.price) * amount;
                    const roi = ((buyer.price - seller.price) / seller.price) * 100;
                    
                    opportunities.push({
                        buyFrom: seller.name,
                        buyPrice: seller.price,
                        sellTo: buyer.name,
                        sellPrice: buyer.price,
                        profit: profit,
                        roi: roi,
                        minAmount: Math.max(seller.minUSDT, buyer.minUSDT),
                        maxAmount: Math.min(seller.maxUSDT, buyer.maxUSDT)
                    });
                }
            });
        });
        
        // Broadcast update
        broadcast({
            type: 'update',
            data: {
                ...p2pCache,
                opportunities: opportunities.sort((a, b) => b.roi - a.roi).slice(0, 10)
            }
        });
        
    } catch (error) {
        console.error('Error fetching P2P data:', error);
    }
}

// API endpoints
app.get('/api/p2p/data', (req, res) => {
    res.json(p2pCache);
});

app.post('/api/p2p/refresh', (req, res) => {
    fetchP2PData();
    res.json({ status: 'refreshing' });
});

// Serve dashboard HTML
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>P2P Merchant Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f1419;
            color: #e7e9ea;
            line-height: 1.5;
        }
        .container { max-width: 1600px; margin: 0 auto; padding: 20px; }
        .header {
            background: linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%);
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            text-align: center;
        }
        h1 { font-size: 2.5em; margin-bottom: 10px; }
        .controls {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        .btn {
            padding: 10px 20px;
            background: #1d9bf0;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        }
        .btn:hover { background: #1a8cd8; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: #16181c;
            border: 1px solid #2f3336;
            border-radius: 15px;
            padding: 20px;
        }
        .card h2 {
            color: #1d9bf0;
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        .merchant {
            background: #1e2124;
            border: 1px solid #2f3336;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 10px;
        }
        .merchant.compatible {
            border-color: #00ba7c;
        }
        .merchant-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .merchant-name {
            font-weight: bold;
            font-size: 1.1em;
        }
        .price {
            font-size: 1.2em;
            font-weight: bold;
            color: #1d9bf0;
        }
        .details {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            font-size: 0.9em;
            color: #8b98a5;
        }
        .payment-methods {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
            margin-top: 8px;
        }
        .payment-badge {
            background: #2f3336;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
        }
        .payment-badge.compatible {
            background: #00ba7c;
            color: white;
        }
        .stat {
            display: flex;
            justify-content: space-between;
        }
        .online { color: #00ba7c; }
        .offline { color: #8b98a5; }
        .opportunity {
            background: #1e2124;
            border: 2px solid #00ba7c;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 10px;
        }
        .profit {
            color: #00ba7c;
            font-weight: bold;
            font-size: 1.2em;
        }
        .last-update {
            text-align: center;
            color: #8b98a5;
            margin-top: 20px;
        }
        .filter-input {
            padding: 10px;
            background: #1e2124;
            border: 1px solid #2f3336;
            border-radius: 8px;
            color: white;
            font-size: 16px;
        }
        .status {
            text-align: center;
            padding: 10px;
            background: #16181c;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .loading { color: #1d9bf0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏪 P2P Merchant Dashboard</h1>
            <p>Real-time Binance P2P merchant data with your payment compatibility</p>
        </div>
        
        <div class="status">
            <span id="status" class="loading">Connecting to live data...</span>
        </div>
        
        <div class="controls">
            <button class="btn" onclick="refreshData()">🔄 Refresh</button>
            <input type="text" class="filter-input" placeholder="Filter by merchant name..." id="filterInput" onkeyup="filterMerchants()">
            <select class="filter-input" id="paymentFilter" onchange="filterMerchants()">
                <option value="">All Payment Methods</option>
                <option value="compatible">Compatible Only</option>
                <option value="UPI">UPI</option>
                <option value="IMPS">IMPS</option>
                <option value="BankIndia">Bank Transfer</option>
            </select>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>💰 Buyers (You Sell USDT)</h2>
                <div id="buyers">Loading...</div>
            </div>
            
            <div class="card">
                <h2>🛒 Sellers (You Buy USDT)</h2>
                <div id="sellers">Loading...</div>
            </div>
            
            <div class="card">
                <h2>🎯 Arbitrage Opportunities</h2>
                <div id="opportunities">Calculating...</div>
            </div>
        </div>
        
        <div class="last-update" id="lastUpdate"></div>
    </div>
    
    <script>
        let ws;
        let allData = { buyers: [], sellers: [], opportunities: [] };
        
        function connectWebSocket() {
            ws = new WebSocket('ws://localhost:3005');
            
            ws.onopen = () => {
                document.getElementById('status').textContent = '✅ Connected - Live updates active';
                document.getElementById('status').classList.remove('loading');
            };
            
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'initial' || message.type === 'update') {
                    allData = message.data;
                    updateDisplay();
                }
            };
            
            ws.onclose = () => {
                document.getElementById('status').textContent = '❌ Disconnected - Reconnecting...';
                document.getElementById('status').classList.add('loading');
                setTimeout(connectWebSocket, 3000);
            };
        }
        
        function updateDisplay() {
            const filterText = document.getElementById('filterInput').value.toLowerCase();
            const paymentFilter = document.getElementById('paymentFilter').value;
            
            // Update buyers
            const buyersHtml = allData.buyers
                .filter(m => {
                    const nameMatch = m.name.toLowerCase().includes(filterText);
                    const paymentMatch = !paymentFilter || 
                        (paymentFilter === 'compatible' && m.compatible) ||
                        m.paymentMethods.includes(paymentFilter);
                    return nameMatch && paymentMatch;
                })
                .map(m => createMerchantCard(m))
                .join('');
            document.getElementById('buyers').innerHTML = buyersHtml || '<p>No matching buyers</p>';
            
            // Update sellers
            const sellersHtml = allData.sellers
                .filter(m => {
                    const nameMatch = m.name.toLowerCase().includes(filterText);
                    const paymentMatch = !paymentFilter || 
                        (paymentFilter === 'compatible' && m.compatible) ||
                        m.paymentMethods.includes(paymentFilter);
                    return nameMatch && paymentMatch;
                })
                .map(m => createMerchantCard(m))
                .join('');
            document.getElementById('sellers').innerHTML = sellersHtml || '<p>No matching sellers</p>';
            
            // Update opportunities
            const oppsHtml = (allData.opportunities || [])
                .map(opp => \`
                    <div class="opportunity">
                        <div style="margin-bottom: 10px;">
                            <strong>Buy from:</strong> \${opp.buyFrom} @ ₹\${opp.buyPrice}<br>
                            <strong>Sell to:</strong> \${opp.sellTo} @ ₹\${opp.sellPrice}
                        </div>
                        <div class="profit">
                            Profit: ₹\${opp.profit.toFixed(2)} (\${opp.roi.toFixed(2)}% ROI)
                        </div>
                        <div style="color: #8b98a5; font-size: 0.9em; margin-top: 5px;">
                            Range: \${opp.minAmount.toFixed(2)} - \${opp.maxAmount.toFixed(2)} USDT
                        </div>
                    </div>
                \`).join('');
            document.getElementById('opportunities').innerHTML = oppsHtml || '<p>No arbitrage opportunities found</p>';
            
            // Update last update time
            if (allData.lastUpdate) {
                document.getElementById('lastUpdate').textContent = 
                    'Last updated: ' + new Date(allData.lastUpdate).toLocaleTimeString();
            }
        }
        
        function createMerchantCard(merchant) {
            return \`
                <div class="merchant \${merchant.compatible ? 'compatible' : ''}">
                    <div class="merchant-header">
                        <span class="merchant-name">\${merchant.name}</span>
                        <span class="price">₹\${merchant.price}</span>
                    </div>
                    <div class="details">
                        <div class="stat">
                            <span>Orders (30d):</span>
                            <span>\${merchant.orders30d}</span>
                        </div>
                        <div class="stat">
                            <span>Completion:</span>
                            <span>\${merchant.completionRate}%</span>
                        </div>
                        <div class="stat">
                            <span>Min-Max INR:</span>
                            <span>₹\${merchant.minLimit.toLocaleString()} - ₹\${merchant.maxLimit.toLocaleString()}</span>
                        </div>
                        <div class="stat">
                            <span>Min-Max USDT:</span>
                            <span>\${merchant.minUSDT.toFixed(2)} - \${merchant.maxUSDT.toFixed(2)}</span>
                        </div>
                        <div class="stat">
                            <span>Available:</span>
                            <span>\${merchant.available.toFixed(2)} USDT</span>
                        </div>
                        <div class="stat">
                            <span>Status:</span>
                            <span class="\${merchant.online ? 'online' : 'offline'}">\${merchant.online ? '🟢 Online' : '🔴 Offline'}</span>
                        </div>
                    </div>
                    <div class="payment-methods">
                        \${merchant.paymentMethods.map(method => 
                            \`<span class="payment-badge \${merchant.compatible && allData.userPaymentMethods.includes(method) ? 'compatible' : ''}">\${method}</span>\`
                        ).join('')}
                    </div>
                </div>
            \`;
        }
        
        function refreshData() {
            fetch('/api/p2p/refresh', { method: 'POST' });
            document.getElementById('status').textContent = '🔄 Refreshing...';
        }
        
        function filterMerchants() {
            updateDisplay();
        }
        
        // Connect and start
        connectWebSocket();
        
        // Auto-refresh every 30 seconds
        setInterval(refreshData, 30000);
    </script>
</body>
</html>
    `);
});

// Start fetching data
fetchP2PData();
setInterval(fetchP2PData, 30000); // Refresh every 30 seconds

server.listen(PORT, () => {
    console.log(`🏪 P2P Merchant Dashboard running at http://localhost:${PORT}`);
    console.log(`✅ WebSocket server ready for real-time updates`);
});