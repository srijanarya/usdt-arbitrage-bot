#!/bin/bash

echo "🔧 Fixing PostgreSQL Setup on macOS"
echo "==================================="
echo ""

# Get current macOS username
CURRENT_USER=$(whoami)
echo "Your macOS username: $CURRENT_USER"
echo ""

echo "Trying different methods to create the database..."
echo ""

# Method 1: Try with current user
echo "Method 1: Using your macOS user ($CURRENT_USER)..."
psql -U $CURRENT_USER -c "CREATE DATABASE arbitrage_bot;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Database created successfully!"
else
    echo "Method 1 failed. Trying Method 2..."
    
    # Method 2: Create postgres user first
    echo ""
    echo "Method 2: Creating postgres user..."
    createuser -s postgres 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Postgres user created!"
        psql -U postgres -c "CREATE DATABASE arbitrage_bot;"
        
        if [ $? -eq 0 ]; then
            echo "✅ Database created successfully!"
        fi
    else
        echo "Method 2 failed. Trying Method 3..."
        
        # Method 3: Use createdb with current user
        echo ""
        echo "Method 3: Using createdb with your user..."
        createdb arbitrage_bot
        
        if [ $? -eq 0 ]; then
            echo "✅ Database created successfully!"
        else
            echo ""
            echo "❌ All automated methods failed."
            echo ""
            echo "Try this manual approach:"
            echo ""
            echo "1. First, let's see what users exist:"
            echo "   psql -U $CURRENT_USER -l"
            echo ""
            echo "2. If that works, create the database:"
            echo "   psql -U $CURRENT_USER"
            echo "   CREATE DATABASE arbitrage_bot;"
            echo "   \q"
            echo ""
            echo "3. If not, initialize PostgreSQL first:"
            echo "   initdb /usr/local/var/postgres"
            echo "   pg_ctl -D /usr/local/var/postgres start"
            echo "   createdb"
            echo "   psql -c 'CREATE DATABASE arbitrage_bot;'"
        fi
    fi
fi

echo ""
echo "Now let's update your .env file to use the correct user..."
echo ""

# Update .env file
if [ -f .env ]; then
    # Backup current .env
    cp .env .env.backup
    
    # Update DB_USER in .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/DB_USER=postgres/DB_USER=$CURRENT_USER/g" .env
    else
        # Linux
        sed -i "s/DB_USER=postgres/DB_USER=$CURRENT_USER/g" .env
    fi
    
    echo "✅ Updated .env file to use DB_USER=$CURRENT_USER"
    echo "(Original backed up to .env.backup)"
fi

echo ""
echo "Testing database connection..."
npx ts-node src/scripts/testDb.ts