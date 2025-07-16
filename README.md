# 🚀 USDT Arbitrage Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

A real-time cryptocurrency arbitrage bot that monitors USDT/USDC price differences across multiple exchanges to identify profitable trading opportunities.

![Dashboard Screenshot](https://via.placeholder.com/800x400?text=USDT+Arbitrage+Bot+Dashboard)

## ✨ Features

- 🔄 **Real-time Price Monitoring** - WebSocket connections for instant price updates
- 💹 **Multi-Exchange Support** - CoinDCX, ZebPay, Binance, KuCoin, CoinSwitch
- 📊 **Live Web Dashboard** - Beautiful UI with auto-refresh capabilities
- 🎯 **Smart Arbitrage Detection** - Considers trading fees and TDS (1% for Indian exchanges)
- 📈 **REST API** - Access all data programmatically
- 💾 **Database Integration** - PostgreSQL for historical data storage
- 🔔 **Profit Alerts** - Get notified when opportunities arise
- 🛡️ **Risk Management** - Built-in safety thresholds and limits

## 🚀 Quick Start (No API Keys Required)

```bash
# Clone the repository
git clone https://github.com/srijanarya/usdt-arbitrage-bot.git
cd usdt-arbitrage-bot

# Quick start with no setup
./start-simple.sh
```

Open http://localhost:3000 in your browser to see the live dashboard!

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL (optional, for full features)
- Exchange API keys (optional, for trading)

## 🔧 Installation

### Basic Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start the development server
npm run dev
```

### Full Setup (with Database)

```bash
# Install dependencies
npm install

# Setup PostgreSQL database
npm run db:setup

# Configure your .env file with API keys
nano .env

# Start the application
npm run dev
```

## 🔑 Configuration

Create a `.env` file with your API credentials:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=arbitrage_bot
DB_USER=postgres
DB_PASSWORD=your_password

# Exchange APIs (Optional)
COINDCX_API_KEY=your_key
COINDCX_API_SECRET=your_secret

ZEBPAY_API_KEY=your_key
ZEBPAY_API_SECRET=your_secret

BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret

KUCOIN_API_KEY=your_key
KUCOIN_API_SECRET=your_secret
KUCOIN_PASSPHRASE=your_passphrase

# Trading Settings
MIN_PROFIT_THRESHOLD=0.1
MAX_TRADE_AMOUNT=10000
ENABLE_AUTO_TRADING=false
```

## 📊 Usage

### Web Dashboard
Access the dashboard at http://localhost:3000 to:
- View real-time prices
- Monitor arbitrage opportunities
- Track profit potential
- Analyze market trends

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/prices` | Current prices from all exchanges |
| `GET /api/opportunities` | Active arbitrage opportunities |
| `GET /api/system-status` | System health and uptime |
| `GET /api/metrics` | Performance statistics |
| `GET /api/historical` | Historical arbitrage data |

### Example API Request

```bash
curl http://localhost:3000/api/opportunities
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "type": "USDT/USDC Binance",
      "spread": 0.15,
      "profitable": true,
      "buyExchange": "Binance",
      "sellExchange": "KuCoin",
      "netProfit": 0.12
    }
  ]
}
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Dashboard │────▶│  Express Server │────▶│   PostgreSQL    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │  Exchange APIs     │
                    ├────────────────────┤
                    │ • CoinDCX          │
                    │ • ZebPay           │
                    │ • Binance          │
                    │ • KuCoin           │
                    │ • CoinSwitch       │
                    └────────────────────┘
```

## 📈 How It Works

1. **Price Collection**: The bot connects to multiple exchanges via WebSocket/REST APIs
2. **Arbitrage Detection**: Continuously analyzes price differences between exchanges
3. **Profit Calculation**: Factors in trading fees, network fees, and TDS
4. **Opportunity Alert**: Notifies when profit exceeds minimum threshold
5. **Risk Management**: Validates opportunities against safety parameters

### Arbitrage Formula

```
Profit = (Sell Price - Buy Price) - Trading Fees - Network Fees - TDS
ROI% = (Profit / Investment) × 100
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- exchanges

# Test with coverage
npm run test:coverage
```

## 🐳 Docker Support

```bash
# Build the image
docker build -t usdt-arbitrage-bot .

# Run the container
docker run -p 3000:3000 --env-file .env usdt-arbitrage-bot
```

## 📚 Project Structure

```
usdt-arbitrage-bot/
├── src/
│   ├── index.ts              # Main application entry
│   ├── api/exchanges/        # Exchange integrations
│   ├── services/             # Core business logic
│   ├── routes/               # API routes
│   ├── config/               # Configuration files
│   └── utils/                # Helper functions
├── public/                   # Frontend assets
├── tests/                    # Test files
├── docs/                     # Documentation
└── scripts/                  # Utility scripts
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This bot is for educational purposes only. Cryptocurrency trading carries significant risks. Always:
- Test with small amounts first
- Understand the tax implications in your jurisdiction
- Never invest more than you can afford to lose
- Verify all transactions before execution

## 🙏 Acknowledgments

- Exchange APIs documentation
- Node.js and TypeScript communities
- Open source contributors

## 📞 Support

- 📧 Email: your-email@example.com
- 💬 Telegram: @your-telegram
- 🐛 Issues: [GitHub Issues](https://github.com/srijanarya/usdt-arbitrage-bot/issues)

---

Made with ❤️ by [Srijan Arya](https://github.com/srijanarya)