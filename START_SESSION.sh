#!/bin/bash

# 🚨 CURSOR-FIRST SESSION STARTER 🚨

echo "================================================"
echo "🚀 USDT ARBITRAGE BOT - CURSOR-FIRST CHECK"
echo "================================================"
echo ""

# Open the reminder dashboard
open /Users/srijan/Desktop/usdt-arbitrage-bot/cursor-reminder-dashboard.html

# Wait for user confirmation
echo "⚠️  MANDATORY CHECKS:"
echo ""
echo "1. ✅ Is Cursor IDE open?"
echo "2. ✅ Is CURSOR_QUICK_START.md open in Cursor?"
echo "3. ✅ Is CURSOR_AI_PROMPTS.md open in Cursor?"
echo "4. ✅ Have you read the CURSOR_FIRST_MANIFESTO?"
echo ""
echo "Press ENTER only after ALL checks are complete..."
read

# Open Cursor if not already open
open -a Cursor /Users/srijan/Desktop/usdt-arbitrage-bot

echo ""
echo "🎯 SESSION GOALS:"
echo "- Use Cmd+K at least 10 times in first 30 minutes"
echo "- Generate ALL code with AI"
echo "- Zero manual typing"
echo "- Complete Day 1 tasks in 2 hours"
echo ""
echo "⏰ Starting session timer..."
echo "💡 Remember: Cmd+K every 5 minutes!"
echo ""

# Create a simple timer
start_time=$(date +%s)
while true; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    minutes=$((elapsed / 60))
    
    # Alert every 15 minutes
    if [ $((minutes % 15)) -eq 0 ] && [ $minutes -gt 0 ] && [ $((elapsed % 60)) -eq 0 ]; then
        osascript -e 'display notification "Have you used Cmd+K?" with title "⏰ 15-Minute Check" sound name "Glass"'
    fi
    
    sleep 1
done
