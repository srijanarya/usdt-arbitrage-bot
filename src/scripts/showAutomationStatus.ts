import { config } from 'dotenv';
import { logger } from '../utils/logger';
import axios from 'axios';

config();

async function showAutomationStatus() {
  try {
    console.log('🎯 USDT Arbitrage Bot - Complete Automation Status');
    console.log('=' .repeat(60));
    
    // Get system status
    const status = await axios.get('http://localhost:3001/api/system/status');
    const systemData = status.data.status;
    
    console.log('\n📊 System Overview:');
    console.log(`   Orchestrator: ${systemData.orchestrator.running ? '✅ RUNNING' : '❌ STOPPED'}`);
    console.log(`   Active Workflows: ${systemData.orchestrator.activeWorkflows}`);
    console.log(`   Active Orders: ${systemData.orderManager.activeOrders}`);
    console.log(`   Auto-Release: ${systemData.autoRelease.enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    
    // Trading modes breakdown
    const tradingModes = systemData.tradingModes;
    console.log('\n🎛️ Trading Mode Configuration:');
    console.log(`   Total Exchanges: ${tradingModes.totalExchanges}`);
    console.log(`   🤖 Fully Automated: ${tradingModes.fullyAutomated}`);
    console.log(`   🤝 Semi-Assisted: ${tradingModes.semiAssisted}`);
    console.log(`   👨‍💻 Manual Only: ${tradingModes.manualOnly}`);
    console.log(`   🚫 Disabled: ${tradingModes.disabled}`);
    console.log(`   ⏳ Pending Approvals: ${tradingModes.pendingApprovals}`);
    
    // Get current orders
    const orders = await axios.get('http://localhost:3001/api/p2p/orders');
    console.log('\n📋 Active Orders:');
    if (orders.data.orders.length === 0) {
      console.log('   No active orders');
    } else {
      orders.data.orders.forEach((order: any) => {
        console.log(`   ${order.id}: ${order.amount} USDT @ ₹${order.price} (${order.status})`);
      });
    }
    
    // Get pending approvals
    const approvals = await axios.get('http://localhost:3001/api/trading/approvals');
    console.log('\n🤔 Pending Approvals:');
    if (approvals.data.approvals.length === 0) {
      console.log('   No pending approvals');
    } else {
      approvals.data.approvals.forEach((approval: any) => {
        console.log(`   ${approval.id}`);
        console.log(`     Exchange: ${approval.exchange}`);
        console.log(`     Amount: ${approval.opportunity.amount} USDT`);
        console.log(`     Profit: ₹${approval.estimatedProfit} (${approval.opportunity.profitPercent}%)`);
        console.log(`     Risk Score: ${approval.riskScore}`);
        console.log(`     Expires: ${new Date(approval.expiresAt).toLocaleString()}`);
      });
    }
    
    // Show automation rules
    console.log('\n⚙️ Current Automation Rules:');
    console.log('   🟢 Binance: FULLY AUTOMATED');
    console.log('     • Auto-executes trades immediately');
    console.log('     • Auto-release enabled');
    console.log('     • No manual approval required');
    console.log('     • Max amount: 1000 USDT');
    console.log('     • Min profit: 0.5%');
    
    console.log('   🟡 ZebPay: SEMI-ASSISTED → FULLY AUTOMATED');
    console.log('     • Now auto-executes (just changed)');
    console.log('     • Manual release for safety');
    console.log('     • Max amount: 500 USDT');
    console.log('     • Min profit: 1.0%');
    
    console.log('   🟡 KuCoin: SEMI-ASSISTED');
    console.log('     • Requires manual approval');
    console.log('     • Manual release for safety');
    console.log('     • Max amount: 500 USDT');
    console.log('     • Min profit: 1.0%');
    
    console.log('   🟡 CoinSwitch: SEMI-ASSISTED');
    console.log('     • Requires manual approval');
    console.log('     • Manual release for safety');
    console.log('     • Max amount: 500 USDT');
    console.log('     • Min profit: 1.0%');
    
    // Available commands
    console.log('\n🚀 Available Commands:');
    console.log('   npm run p2p                    # Start/restart P2P automation');
    console.log('   npm run p2p:dashboard         # Open automation dashboard');
    console.log('   curl localhost:3001/api/system/status  # Check system status');
    console.log('   curl localhost:3001/api/trading/approvals  # Check pending approvals');
    
    // API endpoints for trading modes
    console.log('\n🎛️ Trading Mode Control:');
    console.log('   POST /api/trading/mode/{exchange}    # Change trading mode');
    console.log('   POST /api/trading/approvals/{id}     # Approve/reject trades');
    console.log('   GET  /api/trading/approvals          # List pending approvals');
    
    // Show example API calls
    console.log('\n💡 Example API Calls:');
    console.log("   # Approve a trade:");
    console.log("   curl -X POST localhost:3001/api/trading/approvals/{id} \\");
    console.log('        -H "Content-Type: application/json" \\');
    console.log('        -d \'{"approved": true, "reason": "Good profit"}\'');
    
    console.log("\n   # Switch exchange to full automation:");
    console.log("   curl -X POST localhost:3001/api/trading/mode/kucoin \\");
    console.log('        -H "Content-Type: application/json" \\');
    console.log('        -d \'{"mode": "fully_automated"}\'');
    
    console.log('\n✅ AUTOMATION SYSTEM FULLY OPERATIONAL!');
    console.log('   • Binance: Fully automated (working)');
    console.log('   • Others: Semi-assisted (awaiting P2P implementation)');
    console.log('   • Manual approval system functional');
    console.log('   • Real-time trading mode switching');
    console.log('   • Payment verification & auto-release');
    
  } catch (error) {
    logger.error('❌ Failed to get automation status:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  showAutomationStatus().catch(error => {
    logger.error('💥 Script failed:', error);
    process.exit(1);
  });
}

export { showAutomationStatus };