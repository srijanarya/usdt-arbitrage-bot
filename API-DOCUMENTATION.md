# 📚 USDT Arbitrage Bot API Documentation

## Overview
This document provides comprehensive API documentation for the USDT Arbitrage Bot system, covering all endpoints, authentication, rate limiting, and integration examples.

---

## 🔐 Authentication

### API Key Authentication
All API requests require authentication using an API key in the header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://your-domain.com/api/v1/prices
```

### Environment Variables
```bash
API_KEY=your_secure_api_key_here
API_SECRET=your_api_secret_here
RATE_LIMIT_WINDOW=15  # minutes
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 📊 Exchange Price Endpoints

### GET /api/v1/prices
Get current exchange prices for USDT/INR

**Parameters:**
- `exchange` (optional): Filter by specific exchange
- `include_fees` (optional, default: true): Include trading fees in calculation

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-07-16T10:30:00Z",
  "data": {
    "CoinDCX": {
      "price": 87.48,
      "effective_price": 87.61,
      "trading_fee": 0.001,
      "withdrawal_fee": 1,
      "status": "active",
      "last_updated": "2025-07-16T10:29:45Z"
    },
    "WazirX": {
      "price": 86.74,
      "effective_price": null,
      "trading_fee": 0.002,
      "withdrawal_fee": 1,
      "status": "halted",
      "last_updated": "2025-07-16T10:25:00Z"
    }
  }
}
```

### GET /api/v1/prices/history
Get historical price data

**Parameters:**
- `exchange`: Exchange name
- `from`: Start date (ISO 8601)
- `to`: End date (ISO 8601)
- `interval`: Data interval (1m, 5m, 15m, 1h, 1d)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-07-16T10:00:00Z",
      "price": 87.45,
      "volume": 2500000
    }
  ]
}
```

---

## 🔄 P2P Market Endpoints

### GET /api/v1/p2p/opportunities
Get current P2P arbitrage opportunities

**Parameters:**
- `min_profit` (optional, default: 1.0): Minimum profit percentage
- `platform`: P2P platform filter
- `payment_method`: Payment method filter

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-07-16T10:30:00Z",
  "opportunities": [
    {
      "id": "arb_001",
      "buy_exchange": "CoinDCX",
      "sell_platform": "Binance P2P",
      "buy_price": 87.48,
      "sell_price": 90.20,
      "profit_percentage": 2.85,
      "profit_amount": 906,
      "recommended_volume": 49000,
      "estimated_time": 15,
      "risk_level": "low",
      "payment_methods": ["UPI", "IMPS"],
      "expires_at": "2025-07-16T10:45:00Z"
    }
  ]
}
```

### GET /api/v1/p2p/merchants
Get merchant analysis data

**Parameters:**
- `platform`: P2P platform
- `min_rating` (optional, default: 95): Minimum completion rate
- `payment_method`: Filter by payment method

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "merchant_id": "merchant_123",
      "name": "CryptoKing99",
      "platform": "Binance P2P",
      "completion_rate": 99.8,
      "trade_count": 2547,
      "avg_response_time": 2,
      "volume_30d": 15000000,
      "payment_methods": ["UPI", "IMPS"],
      "rating": "excellent",
      "verified": true,
      "active_hours": "09:00-23:00 IST"
    }
  ]
}
```

---

## 📈 Trading Endpoints

### POST /api/v1/trades
Record a new trade

**Request Body:**
```json
{
  "buy_exchange": "CoinDCX",
  "sell_platform": "Binance P2P",
  "buy_price": 87.48,
  "sell_price": 90.20,
  "amount_inr": 49000,
  "payment_method": "UPI",
  "notes": "Fast execution, good merchant"
}
```

**Response:**
```json
{
  "success": true,
  "trade_id": "trade_12345",
  "profit_percentage": 2.85,
  "profit_amount": 906,
  "fees": {
    "trading_fee": 49,
    "gst": 8.82,
    "total": 57.82
  },
  "net_profit": 848.18
}
```

### GET /api/v1/trades
Get trade history

**Parameters:**
- `from`: Start date
- `to`: End date
- `exchange`: Filter by exchange
- `platform`: Filter by P2P platform
- `limit` (default: 50): Number of records

**Response:**
```json
{
  "success": true,
  "total": 156,
  "data": [
    {
      "trade_id": "trade_12345",
      "timestamp": "2025-07-16T10:30:00Z",
      "buy_exchange": "CoinDCX",
      "sell_platform": "Binance P2P",
      "profit_percentage": 2.85,
      "profit_amount": 906,
      "status": "completed"
    }
  ]
}
```

---

## 📊 Analytics Endpoints

### GET /api/v1/analytics/summary
Get trading performance summary

**Parameters:**
- `period`: Time period (7d, 30d, 90d, 1y)

**Response:**
```json
{
  "success": true,
  "period": "30d",
  "summary": {
    "total_trades": 45,
    "total_profit": 28500,
    "avg_profit_per_trade": 633,
    "success_rate": 97.8,
    "best_trade": 1250,
    "total_volume": 2205000,
    "avg_roi": 2.1,
    "tds_saved": 2205
  }
}
```

### GET /api/v1/analytics/performance
Get detailed performance metrics

**Response:**
```json
{
  "success": true,
  "data": {
    "daily_profits": [
      {
        "date": "2025-07-15",
        "profit": 1250,
        "trades": 3
      }
    ],
    "exchange_performance": {
      "CoinDCX": {
        "trades": 25,
        "avg_profit": 2.1,
        "success_rate": 98.0
      }
    },
    "platform_performance": {
      "Binance P2P": {
        "trades": 30,
        "avg_premium": 2.8,
        "avg_time": 12
      }
    }
  }
}
```

---

## 🔔 Notification Endpoints

### POST /api/v1/notifications/telegram
Send Telegram notification

**Request Body:**
```json
{
  "type": "arbitrage_alert",
  "data": {
    "profit_percentage": 2.85,
    "route": "CoinDCX → Binance P2P",
    "amount": 49000
  }
}
```

**Response:**
```json
{
  "success": true,
  "message_id": "msg_123",
  "sent_at": "2025-07-16T10:30:00Z"
}
```

### GET /api/v1/notifications/settings
Get notification preferences

**Response:**
```json
{
  "success": true,
  "settings": {
    "telegram_enabled": true,
    "min_profit_threshold": 2.0,
    "high_profit_threshold": 3.5,
    "alert_frequency": "immediate",
    "quiet_hours": {
      "enabled": true,
      "start": "23:00",
      "end": "07:00"
    }
  }
}
```

---

## 🏛️ Compliance Endpoints

### GET /api/v1/compliance/tds-report
Generate TDS compliance report

**Parameters:**
- `financial_year`: FY (e.g., "2024-25")
- `format`: Response format (json, csv)

**Response:**
```json
{
  "success": true,
  "financial_year": "2024-25",
  "summary": {
    "total_transactions": 156,
    "transactions_over_50k": 0,
    "tds_applicable": 0,
    "tds_saved": 2205,
    "total_profit": 28500,
    "tax_liability": 8550
  },
  "transactions": [
    {
      "date": "2025-07-16",
      "amount": 49000,
      "profit": 906,
      "tds_deducted": 0
    }
  ]
}
```

### GET /api/v1/compliance/tax-summary
Get tax summary for ITR filing

**Response:**
```json
{
  "success": true,
  "tax_summary": {
    "total_profit": 28500,
    "capital_gains_tax": 8550,
    "tds_deducted": 0,
    "net_tax_liability": 8550,
    "transactions_count": 156,
    "documentation_complete": true
  }
}
```

---

## ⚙️ Configuration Endpoints

### GET /api/v1/config/exchanges
Get exchange configuration

**Response:**
```json
{
  "success": true,
  "exchanges": {
    "CoinDCX": {
      "enabled": true,
      "api_connected": true,
      "trading_fee": 0.001,
      "withdrawal_fee": 1,
      "status": "active"
    },
    "WazirX": {
      "enabled": false,
      "api_connected": false,
      "trading_fee": 0.002,
      "withdrawal_fee": 1,
      "status": "halted"
    }
  }
}
```

### POST /api/v1/config/alerts
Update alert configuration

**Request Body:**
```json
{
  "min_profit_threshold": 2.0,
  "high_profit_threshold": 3.5,
  "telegram_enabled": true,
  "quiet_hours_enabled": true
}
```

---

## 🔄 WebSocket API

### Connection
```javascript
const ws = new WebSocket('wss://your-domain.com/ws');

ws.onopen = function() {
  // Subscribe to real-time updates
  ws.send(JSON.stringify({
    action: 'subscribe',
    channels: ['prices', 'opportunities', 'trades']
  }));
};
```

### Message Types

**Price Updates:**
```json
{
  "type": "price_update",
  "data": {
    "exchange": "CoinDCX",
    "price": 87.52,
    "timestamp": "2025-07-16T10:30:00Z"
  }
}
```

**Arbitrage Opportunities:**
```json
{
  "type": "arbitrage_opportunity",
  "data": {
    "profit_percentage": 2.95,
    "route": "CoinDCX → Binance P2P",
    "expires_in": 900
  }
}
```

---

## 🚦 Rate Limiting

- **Default Limit**: 100 requests per 15-minute window
- **Burst Limit**: 20 requests per minute
- **WebSocket**: 1 connection per API key

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642781400
```

---

## ❌ Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Exchange parameter is required",
    "details": {
      "field": "exchange",
      "provided": null,
      "expected": "string"
    }
  },
  "timestamp": "2025-07-16T10:30:00Z"
}
```

### Error Codes
- `INVALID_API_KEY`: Authentication failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INVALID_PARAMETERS`: Request validation failed
- `EXCHANGE_UNAVAILABLE`: Exchange API down
- `INSUFFICIENT_DATA`: Not enough data for calculation
- `INTERNAL_ERROR`: Server error

---

## 🔧 Integration Examples

### Python Example
```python
import requests
import json

class ArbitrageAPI:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def get_opportunities(self, min_profit=2.0):
        response = requests.get(
            f'{self.base_url}/api/v1/p2p/opportunities',
            headers=self.headers,
            params={'min_profit': min_profit}
        )
        return response.json()
    
    def record_trade(self, trade_data):
        response = requests.post(
            f'{self.base_url}/api/v1/trades',
            headers=self.headers,
            json=trade_data
        )
        return response.json()

# Usage
api = ArbitrageAPI('your_api_key', 'https://your-domain.com')
opportunities = api.get_opportunities(min_profit=2.5)
```

### JavaScript Example
```javascript
class ArbitrageAPI {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async makeRequest(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    return response.json();
  }

  async getOpportunities(minProfit = 2.0) {
    return this.makeRequest(`/api/v1/p2p/opportunities?min_profit=${minProfit}`);
  }

  async recordTrade(tradeData) {
    return this.makeRequest('/api/v1/trades', {
      method: 'POST',
      body: JSON.stringify(tradeData)
    });
  }
}

// Usage
const api = new ArbitrageAPI('your_api_key', 'https://your-domain.com');
const opportunities = await api.getOpportunities(2.5);
```

---

## 🧪 Testing

### Test Environment
- **Base URL**: `https://api-test.your-domain.com`
- **API Key**: Use `test_` prefixed keys
- **Rate Limits**: Relaxed for testing

### Health Check
```bash
curl https://your-domain.com/api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-07-16T10:30:00Z",
  "uptime": 3600,
  "services": {
    "database": "healthy",
    "telegram": "healthy",
    "exchanges": "partial"
  }
}
```

---

## 📝 Changelog

### v1.0.0 (2025-07-16)
- Initial API release
- Core arbitrage endpoints
- P2P merchant analysis
- Telegram integration
- TDS compliance features

---

## 🔒 Security Best Practices

1. **API Key Security**
   - Never expose API keys in client-side code
   - Use environment variables for keys
   - Rotate keys regularly

2. **Request Validation**
   - All inputs are validated and sanitized
   - SQL injection protection
   - XSS protection

3. **Rate Limiting**
   - Protects against abuse
   - Fair usage enforcement
   - DDoS mitigation

4. **HTTPS Only**
   - All API calls must use HTTPS
   - TLS 1.2+ required
   - Certificate pinning recommended

---

## 📞 Support

- **Email**: support@your-domain.com
- **Documentation**: https://docs.your-domain.com
- **Status Page**: https://status.your-domain.com
- **GitHub Issues**: https://github.com/your-repo/issues

---

## 📄 License

This API is part of the USDT Arbitrage Bot system. See LICENSE file for details.