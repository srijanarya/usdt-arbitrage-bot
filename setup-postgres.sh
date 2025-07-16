#!/bin/bash

echo "🚀 PostgreSQL Setup for USDT Arbitrage Bot"
echo "=========================================="
echo ""

# Check if PostgreSQL is installed
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is installed"
    
    # Try to create database
    echo "Creating database 'arbitrage_bot'..."
    
    # First try without password
    psql -U postgres -c "CREATE DATABASE arbitrage_bot;" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Database created successfully!"
    else
        echo "Trying with sudo..."
        sudo -u postgres psql -c "CREATE DATABASE arbitrage_bot;" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "✅ Database created successfully with sudo!"
        else
            echo "⚠️  Could not create database automatically."
            echo ""
            echo "Please try manually:"
            echo "1. Open Terminal"
            echo "2. Run: psql -U postgres"
            echo "3. Enter your postgres password"
            echo "4. Run: CREATE DATABASE arbitrage_bot;"
            echo "5. Run: \\q to exit"
        fi
    fi
    
    # Create tables
    echo ""
    echo "Creating database tables..."
    psql -U postgres -d arbitrage_bot << EOF
-- Exchanges table
CREATE TABLE IF NOT EXISTS exchanges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    exchange_id INTEGER REFERENCES exchanges(id),
    pair VARCHAR(20) NOT NULL,
    bid_price DECIMAL(20, 8),
    ask_price DECIMAL(20, 8),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Arbitrage opportunities table
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    id SERIAL PRIMARY KEY,
    buy_exchange_id INTEGER REFERENCES exchanges(id),
    sell_exchange_id INTEGER REFERENCES exchanges(id),
    pair VARCHAR(20) NOT NULL,
    buy_price DECIMAL(20, 8),
    sell_price DECIMAL(20, 8),
    profit_amount DECIMAL(20, 8),
    profit_percentage DECIMAL(5, 2),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial exchanges
INSERT INTO exchanges (name) VALUES 
    ('ZebPay'),
    ('CoinDCX')
ON CONFLICT (name) DO NOTHING;

EOF

    echo "✅ Database setup complete!"
    
else
    echo "❌ PostgreSQL is not installed"
    echo ""
    echo "To install PostgreSQL on Mac:"
    echo "1. Using Homebrew: brew install postgresql"
    echo "2. Start PostgreSQL: brew services start postgresql"
    echo "3. Run this script again"
fi

echo ""
echo "Next steps:"
echo "1. Update DB_PASSWORD in your .env file"
echo "2. Run: npx ts-node src/test-zebpay.ts"
echo "3. Run: npx ts-node src/monitor.ts"