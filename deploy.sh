#!/bin/bash
set -e

echo "🚀 Starting USDT Arbitrage Bot deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check if .env file exists
if [[ ! -f .env ]]; then
    print_error ".env file not found. Please create it first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_warning "Docker not found. Installing Docker..."
    
    # Install Docker
    sudo apt-get update
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add user to docker group
    sudo usermod -aG docker $USER
    print_status "Docker installed successfully. Please logout and login again."
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_warning "Docker Compose not found. Installing..."
    sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed successfully."
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_warning "Node.js not found. Installing Node.js 18..."
    
    # Install Node.js 18
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status "Node.js installed successfully."
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 not found. Installing PM2..."
    sudo npm install -g pm2
    print_status "PM2 installed successfully."
fi

# Ask for deployment type
echo "Choose deployment type:"
echo "1) Docker Compose (Recommended)"
echo "2) Traditional VPS with PM2"
echo "3) Development mode"
read -p "Enter your choice (1-3): " deploy_type

case $deploy_type in
    1)
        print_status "Deploying with Docker Compose..."
        
        # Check if docker-compose.yml exists
        if [[ ! -f docker-compose.yml ]]; then
            print_error "docker-compose.yml not found!"
            exit 1
        fi
        
        # Build and start services
        docker-compose down
        docker-compose build
        docker-compose up -d
        
        # Wait for services to start
        print_status "Waiting for services to start..."
        sleep 30
        
        # Check if services are running
        if docker-compose ps | grep -q "Up"; then
            print_status "✅ Services are running successfully!"
            
            # Show running services
            docker-compose ps
            
            # Show logs
            print_status "Recent logs:"
            docker-compose logs --tail=20
            
        else
            print_error "❌ Some services failed to start. Check logs:"
            docker-compose logs
            exit 1
        fi
        ;;
        
    2)
        print_status "Deploying with PM2..."
        
        # Install dependencies
        print_status "Installing dependencies..."
        npm ci --production
        
        # Build TypeScript
        print_status "Building application..."
        npm run build
        
        # Check if PostgreSQL is running
        if ! sudo systemctl is-active --quiet postgresql; then
            print_warning "PostgreSQL not running. Starting PostgreSQL..."
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
        fi
        
        # Run database setup
        print_status "Setting up database..."
        npm run db:setup 2>/dev/null || print_warning "Database setup failed or already exists"
        
        # Start application with PM2
        print_status "Starting application with PM2..."
        pm2 delete arbitrage-bot 2>/dev/null || true
        pm2 start ecosystem.config.js --env production
        pm2 save
        
        # Setup PM2 startup
        pm2 startup 2>/dev/null || print_warning "PM2 startup setup failed"
        
        print_status "✅ Application started successfully!"
        pm2 status
        ;;
        
    3)
        print_status "Starting in development mode..."
        
        # Install dependencies
        npm install
        
        # Start development server
        npm run dev
        ;;
        
    *)
        print_error "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Health check
print_status "Performing health check..."
sleep 10

# Check if application is responding
if curl -f http://localhost:3000/health &> /dev/null; then
    print_status "✅ Health check passed!"
else
    print_warning "⚠️  Health check failed. Check application logs."
fi

# Show final status
print_status "🎉 Deployment completed!"
print_status "📊 Access your dashboards:"
print_status "   - Main Dashboard: http://localhost:3000"
print_status "   - P2P Optimizer: http://localhost:3000/P2P-SELLER-OPTIMIZER.html"
print_status "   - Profit Tracker: http://localhost:3000/PROFIT-TRACKER.html"
print_status "   - Live Monitor: http://localhost:3000/LIVE-ARBITRAGE-TESTER.html"
print_status "   - Telegram Tester: http://localhost:3000/TELEGRAM-TESTER.html"

# Show monitoring commands
print_status "📱 Monitoring commands:"
if [[ $deploy_type == "1" ]]; then
    print_status "   - View logs: docker-compose logs -f"
    print_status "   - Stop services: docker-compose down"
    print_status "   - Restart services: docker-compose restart"
else
    print_status "   - View logs: pm2 logs arbitrage-bot"
    print_status "   - Monitor: pm2 monit"
    print_status "   - Restart: pm2 restart arbitrage-bot"
fi

print_status "🚀 Your USDT Arbitrage Bot is now running in production!"