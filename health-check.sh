#!/bin/bash

echo "🏥 Running Health Check..."
echo "========================="

# Check if bot process is running
BOT_PID=$(pgrep -f "node.*optimized")
if [ -n "$BOT_PID" ]; then
    echo "✅ Bot process running (PID: $BOT_PID)"
else
    echo "❌ Bot process not found"
fi

# Check Redis connection
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli ping >/dev/null 2>&1; then
        echo "✅ Redis connection OK"
    else
        echo "❌ Redis connection failed"
    fi
else
    echo "⚠️  Redis not installed"
fi

# Check API endpoints
if curl -s http://localhost:3001/metrics >/dev/null 2>&1; then
    echo "✅ Performance dashboard accessible"
else
    echo "❌ Performance dashboard not responding"
fi

# Check disk space
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    echo "✅ Disk usage OK ($DISK_USAGE%)"
else
    echo "⚠️  High disk usage ($DISK_USAGE%)"
fi

# Check memory usage
if command -v free >/dev/null 2>&1; then
    MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    if [ "$MEM_USAGE" -lt 90 ]; then
        echo "✅ Memory usage OK ($MEM_USAGE%)"
    else
        echo "⚠️  High memory usage ($MEM_USAGE%)"
    fi
fi

echo ""
echo "Health check complete!"
