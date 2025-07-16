import { Router } from 'express';
import { MultiExchangeMonitor } from '../monitorMultiExchange';

const router = Router();

// In-memory storage for historical data (replace with database later)
interface HistoricalData {
  timestamp: Date;
  opportunities: any[];
  metrics: any;
}

interface Trade {
  id: string;
  timestamp: Date;
  exchange: string;
  pair: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  profit?: number;
}

const historicalData: HistoricalData[] = [];
const trades: Trade[] = [];
const systemStartTime = Date.now();

// Store reference to monitor (will be used for real-time data)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _monitor: MultiExchangeMonitor | null = null;

export function setMonitor(m: MultiExchangeMonitor) {
  _monitor = m;
}

// GET /api/historical - Historical arbitrage data
router.get('/historical', (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  
  const data = historicalData
    .slice(Number(offset), Number(offset) + Number(limit))
    .map(item => ({
      timestamp: item.timestamp,
      opportunities: item.opportunities,
      metrics: item.metrics
    }));
    
  res.json({
    success: true,
    data,
    total: historicalData.length,
    limit: Number(limit),
    offset: Number(offset)
  });
});

// GET /api/system-status - System health metrics
router.get('/system-status', (_req, res) => {
  const uptime = Date.now() - systemStartTime;
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    data: {
      status: 'operational',
      uptime: {
        ms: uptime,
        formatted: formatUptime(uptime)
      },
      memory: {
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
      },
      nodeVersion: process.version,
      timestamp: new Date()
    }
  });
});

// GET /api/metrics - Performance statistics
router.get('/metrics', (_req, res) => {
  const totalOpportunities = historicalData.reduce((sum, item) => 
    sum + (item.opportunities?.length || 0), 0
  );
  
  const profitableOpportunities = historicalData.reduce((sum, item) => 
    sum + (item.opportunities?.filter(o => o.netProfit > 0).length || 0), 0
  );
  
  const completedTrades = trades.filter(t => t.status === 'completed');
  const totalProfit = completedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
  
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
      trades: {
        total: trades.length,
        completed: completedTrades.length,
        pending: trades.filter(t => t.status === 'pending').length,
        failed: trades.filter(t => t.status === 'failed').length
      },
      profit: {
        total: totalProfit.toFixed(4),
        average: completedTrades.length > 0 
          ? (totalProfit / completedTrades.length).toFixed(4)
          : '0'
      },
      lastUpdate: new Date()
    }
  });
});

// GET /api/opportunities - Current arbitrage opportunities
router.get('/opportunities', (_req, res) => {
  const currentOpportunities = historicalData.length > 0 
    ? historicalData[historicalData.length - 1].opportunities 
    : [];
  
  // Also check if monitor is running
  const monitorStatus = _monitor ? 'active' : 'inactive';
    
  res.json({
    success: true,
    data: {
      opportunities: currentOpportunities,
      count: currentOpportunities.length,
      monitorStatus,
      timestamp: new Date()
    }
  });
});

// GET /api/exchanges - Exchange connection status
router.get('/exchanges', (_req, res) => {
  const exchanges = [
    {
      name: 'ZebPay',
      status: 'connected',
      pair: 'USDT/INR',
      features: ['spot', 'public_data'],
      lastUpdate: new Date()
    },
    {
      name: 'KuCoin',
      status: 'connected',
      pair: 'USDT/USDC',
      features: ['spot', 'public_data', 'trading_ready'],
      lastUpdate: new Date()
    },
    {
      name: 'Binance',
      status: 'connected',
      pair: 'USDC/USDT',
      features: ['spot', 'public_data', 'trading_ready', 'websocket'],
      lastUpdate: new Date()
    }
  ];
  
  res.json({
    success: true,
    data: {
      exchanges,
      total: exchanges.length,
      connected: exchanges.filter(e => e.status === 'connected').length
    }
  });
});

// GET /api/trades - Trade execution history
router.get('/trades', (req, res) => {
  const { limit = 50, offset = 0, status } = req.query;
  
  let filteredTrades = trades;
  
  if (status) {
    filteredTrades = trades.filter(t => t.status === status);
  }
  
  const data = filteredTrades
    .slice(Number(offset), Number(offset) + Number(limit))
    .reverse(); // Most recent first
    
  res.json({
    success: true,
    data,
    total: filteredTrades.length,
    limit: Number(limit),
    offset: Number(offset)
  });
});

// Helper function to format uptime
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Function to add historical data point
export function addHistoricalDataPoint(opportunities: any[], metrics: any) {
  historicalData.push({
    timestamp: new Date(),
    opportunities,
    metrics
  });
  
  // Keep only last 1000 data points
  if (historicalData.length > 1000) {
    historicalData.shift();
  }
}

// Function to add trade
export function addTrade(trade: Omit<Trade, 'id' | 'timestamp'>) {
  trades.push({
    ...trade,
    id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date()
  });
}

export default router;