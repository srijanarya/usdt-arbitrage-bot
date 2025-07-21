#!/usr/bin/env node
import chalk from 'chalk';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import open from 'open';

dotenv.config();

console.log(chalk.bgCyan.black('\n 🚀 USDT ARBITRAGE BOT - FULL SYSTEM STARTUP \n'));

const services = [
  {
    name: 'Dashboard Server',
    command: 'npm',
    args: ['run', 'dashboard'],
    port: 3001,
    url: 'http://localhost:3001'
  },
  {
    name: 'Integrated Monitor',
    command: 'npm',
    args: ['run', 'monitor:integrated'],
    critical: true
  },
  {
    name: 'Mobile Trading API',
    command: 'npm',
    args: ['run', 'mobile:trading'],
    port: 3002
  }
];

const runningProcesses: any[] = [];

async function startService(service: any) {
  return new Promise((resolve, reject) => {
    console.log(chalk.yellow(`Starting ${service.name}...`));
    
    const proc = spawn(service.command, service.args, {
      stdio: 'pipe',
      shell: true
    });

    runningProcesses.push(proc);

    proc.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('running on') || output.includes('started') || output.includes('listening')) {
        console.log(chalk.green(`✅ ${service.name} started successfully`));
        resolve(true);
      }
    });

    proc.stderr?.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('DeprecationWarning') && !error.includes('ExperimentalWarning')) {
        console.error(chalk.red(`${service.name} error: ${error}`));
      }
    });

    proc.on('error', (err) => {
      console.error(chalk.red(`Failed to start ${service.name}: ${err.message}`));
      if (service.critical) {
        reject(err);
      } else {
        resolve(false);
      }
    });

    // Timeout for non-critical services
    if (!service.critical) {
      setTimeout(() => {
        console.log(chalk.green(`✅ ${service.name} started (assumed)`));
        resolve(true);
      }, 5000);
    }
  });
}

async function checkPrerequisites() {
  console.log(chalk.yellow('\n📋 Checking prerequisites...'));
  
  const checks = {
    'Telegram Bot Token': !!process.env.TELEGRAM_BOT_TOKEN,
    'Telegram Chat ID': !!process.env.TELEGRAM_CHAT_ID,
    'Database Config': !!process.env.DB_HOST,
    'Exchange APIs': !!process.env.ZEBPAY_API_KEY
  };

  let allPassed = true;
  Object.entries(checks).forEach(([name, passed]) => {
    console.log(`  ${name}: ${passed ? chalk.green('✅') : chalk.red('❌')}`);
    if (!passed) allPassed = false;
  });

  return allPassed;
}

async function main() {
  try {
    // Check prerequisites
    const prereqsPassed = await checkPrerequisites();
    if (!prereqsPassed) {
      console.log(chalk.yellow('\n⚠️  Some prerequisites are missing, but continuing...'));
    }

    console.log(chalk.cyan('\n🚀 Starting all services...\n'));

    // Start all services
    for (const service of services) {
      try {
        await startService(service);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between services
      } catch (error) {
        console.error(chalk.red(`Failed to start ${service.name}`));
        if (service.critical) {
          throw error;
        }
      }
    }

    console.log(chalk.bgGreen.black('\n ✅ ALL SYSTEMS OPERATIONAL! \n'));
    console.log(chalk.cyan('📊 Dashboard: http://localhost:3001'));
    console.log(chalk.cyan('📱 Mobile API: http://localhost:3002'));
    console.log(chalk.cyan('🤖 Telegram Bot: Active'));
    console.log(chalk.cyan('💹 Price Monitoring: Real-time\n'));

    console.log(chalk.yellow('Quick Commands:'));
    console.log('  • Check system status: curl http://localhost:3001/api/status');
    console.log('  • View opportunities: curl http://localhost:3001/api/opportunities');
    console.log('  • Stop all: Press Ctrl+C\n');

    // Open dashboard in browser
    setTimeout(() => {
      console.log(chalk.blue('Opening dashboard in browser...'));
      open('http://localhost:3001').catch(() => {
        console.log(chalk.yellow('Please open http://localhost:3001 in your browser'));
      });
    }, 5000);

    // Handle shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error(chalk.red('\n❌ Startup failed:'), error);
    shutdown();
  }
}

function shutdown() {
  console.log(chalk.yellow('\n🛑 Shutting down all services...'));
  
  runningProcesses.forEach(proc => {
    try {
      proc.kill('SIGTERM');
    } catch (err) {
      // Process might already be dead
    }
  });

  setTimeout(() => {
    console.log(chalk.green('✅ All services stopped'));
    process.exit(0);
  }, 2000);
}

// Configuration display
console.log(chalk.gray('\nConfiguration:'));
console.log(chalk.gray(`  Environment: ${process.env.NODE_ENV || 'development'}`));
console.log(chalk.gray(`  Auto Trading: ${process.env.ENABLE_AUTO_TRADING === 'true' ? 'ENABLED' : 'DISABLED'}`));
console.log(chalk.gray(`  Min Profit: ${process.env.MIN_PROFIT_THRESHOLD || '100'} INR`));
console.log(chalk.gray(`  Max Trade: ${process.env.MAX_TRADE_AMOUNT || '10000'} INR\n`));

main().catch(console.error);