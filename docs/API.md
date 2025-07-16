# USDT Arbitrage Bot API Documentation

## Base URL
```
http://localhost:3000/api
```

## Endpoints

### 1. Historical Data
Get historical arbitrage opportunity data.

**Endpoint:** `GET /api/historical`

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 100)
- `offset` (optional): Number of records to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-01-16T10:30:00.000Z",
      "opportunities": [...],
      "metrics": {...}
    }
  ],
  "total": 150,
  "limit": 100,
  "offset": 0
}
```

### 2. System Status
Get system health and status information.

**Endpoint:** `GET /api/system-status`

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "operational",
    "uptime": {
      "ms": 3600000,
      "formatted": "1h 0m 0s"
    },
    "memory": {
      "rss": "125.50 MB",
      "heapUsed": "45.25 MB",
      "heapTotal": "80.00 MB"
    },
    "nodeVersion": "v20.0.0",
    "timestamp": "2024-01-16T10:30:00.000Z"
  }
}
```

### 3. Metrics
Get performance statistics and metrics.

**Endpoint:** `GET /api/metrics`

**Response:**
```json
{
  "success": true,
  "data": {
    "opportunities": {
      "total": 1250,
      "profitable": 125,
      "profitRate": "10.00%"
    },
    "trades": {
      "total": 50,
      "completed": 45,
      "pending": 3,
      "failed": 2
    },
    "profit": {
      "total": "125.5000",
      "average": "2.7889"
    },
    "lastUpdate": "2024-01-16T10:30:00.000Z"
  }
}
```

### 4. Current Opportunities
Get current arbitrage opportunities.

**Endpoint:** `GET /api/opportunities`

**Response:**
```json
{
  "success": true,
  "data": {
    "opportunities": [
      {
        "strategy": "USDT → USDC → USDT",
        "route": "KuCoin → Binance",
        "grossProfit": 0.25,
        "netProfit": 0.05,
        "timestamp": "2024-01-16T10:30:00.000Z"
      }
    ],
    "count": 1,
    "timestamp": "2024-01-16T10:30:00.000Z"
  }
}
```

### 5. Exchange Status
Get status of connected exchanges.

**Endpoint:** `GET /api/exchanges`

**Response:**
```json
{
  "success": true,
  "data": {
    "exchanges": [
      {
        "name": "ZebPay",
        "status": "connected",
        "pair": "USDT/INR",
        "features": ["spot", "public_data"],
        "lastUpdate": "2024-01-16T10:30:00.000Z"
      },
      {
        "name": "KuCoin",
        "status": "connected",
        "pair": "USDT/USDC",
        "features": ["spot", "public_data", "trading_ready"],
        "lastUpdate": "2024-01-16T10:30:00.000Z"
      },
      {
        "name": "Binance",
        "status": "connected",
        "pair": "USDC/USDT",
        "features": ["spot", "public_data", "trading_ready", "websocket"],
        "lastUpdate": "2024-01-16T10:30:00.000Z"
      }
    ],
    "total": 3,
    "connected": 3
  }
}
```

### 6. Trade History
Get trade execution history.

**Endpoint:** `GET /api/trades`

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 50)
- `offset` (optional): Number of records to skip (default: 0)
- `status` (optional): Filter by status ('pending', 'completed', 'failed')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "trade_1234567890_abc123",
      "timestamp": "2024-01-16T10:30:00.000Z",
      "exchange": "Binance",
      "pair": "USDC/USDT",
      "side": "buy",
      "price": 0.9998,
      "amount": 1000,
      "status": "completed",
      "profit": 2.5
    }
  ],
  "total": 50,
  "limit": 50,
  "offset": 0
}
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

## Rate Limits

Currently no rate limits are implemented, but this may change in production.

## WebSocket API

Connect to `ws://localhost:3000` for real-time updates.

### Message Types:

1. **Price Update**
```json
{
  "type": "price_update",
  "data": {
    "exchange": "Binance",
    "pair": "USDC/USDT",
    "bid": 0.9998,
    "ask": 0.9999,
    "last": 0.9998,
    "timestamp": "2024-01-16T10:30:00.000Z"
  }
}
```

2. **Arbitrage Opportunity**
```json
{
  "type": "arbitrage_opportunity",
  "data": {
    "strategy": "USDT → USDC → USDT",
    "route": "KuCoin → Binance",
    "grossProfit": 0.25,
    "netProfit": 0.05,
    "timestamp": "2024-01-16T10:30:00.000Z"
  }
}
```

3. **Error**
```json
{
  "type": "error",
  "data": {
    "message": "Connection to exchange failed"
  }
}
```