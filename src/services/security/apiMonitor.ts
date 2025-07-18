import { EventEmitter } from 'events';
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { telegramNotifier } from '../telegram.js';
import * as os from 'os';

interface APIActivity {
  exchange: string;
  timestamp: Date;
  action: string;
  ip?: string;
  success: boolean;
  details?: any;
}

export class APISecurityMonitor extends EventEmitter {
  private activities: APIActivity[] = [];
  private monitoringInterval: NodeJS.Timer | null = null;
  private readonly allowedIPs: Set<string> = new Set();
  private suspiciousActivityCount = 0;

  constructor() {
    super();
    this.initializeAllowedIPs();
  }

  private async initializeAllowedIPs() {
    // Get current machine's IPs
    const networkInterfaces = os.networkInterfaces();
    Object.values(networkInterfaces).forEach(interfaces => {
      interfaces?.forEach(iface => {
        if (iface.address) {
          this.allowedIPs.add(iface.address);
        }
      });
    });

    // Add your known IPs
    this.allowedIPs.add('2402:e280:3d29:8fc:ac10:8598:7525:e995'); // Your IPv6
    this.allowedIPs.add('103.195.202.249'); // Your IPv4 if stable
    
    logger.info('Initialized allowed IPs:', Array.from(this.allowedIPs));
  }

  startMonitoring(intervalMinutes: number = 5) {
    this.monitoringInterval = setInterval(() => {
      this.checkAllExchanges();
    }, intervalMinutes * 60 * 1000);

    // Initial check
    this.checkAllExchanges();
    logger.info('API Security monitoring started');
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private async checkAllExchanges() {
    await Promise.all([
      this.checkBinanceActivity(),
      this.checkKuCoinActivity(),
      this.checkZebPayActivity()
    ]);

    this.analyzeActivities();
  }

  private async checkBinanceActivity() {
    try {
      const apiKey = process.env.BINANCE_API_KEY;
      const apiSecret = process.env.BINANCE_API_SECRET;
      
      if (!apiKey || !apiSecret) return;

      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');

      // Check API key permissions
      const response = await axios.get(
        `https://api.binance.com/sapi/v1/account/apiRestrictions?${queryString}&signature=${signature}`,
        {
          headers: { 'X-MBX-APIKEY': apiKey }
        }
      );

      const restrictions = response.data;
      
      // Check if unexpected permissions are enabled
      if (restrictions.enableWithdrawals) {
        this.raiseSuspiciousActivity('Binance', 'Withdrawal permission enabled on API key!');
      }

      this.recordActivity({
        exchange: 'Binance',
        timestamp: new Date(),
        action: 'permission_check',
        success: true,
        details: restrictions
      });

    } catch (error: any) {
      if (error.response?.status !== 401) {
        logger.error('Binance monitoring error:', error.message);
      }
    }
  }

  private async checkKuCoinActivity() {
    // KuCoin doesn't have a direct API activity endpoint
    // But we can check account changes
    try {
      const apiKey = process.env.KUCOIN_API_KEY;
      const apiSecret = process.env.KUCOIN_API_SECRET;
      const passphrase = process.env.KUCOIN_PASSPHRASE;
      
      if (!apiKey || !apiSecret || !passphrase) return;

      const timestamp = Date.now();
      const method = 'GET';
      const endpoint = '/api/v1/accounts';
      const str = timestamp + method + endpoint;
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(str)
        .digest('base64');

      const passphraseEncrypted = crypto
        .createHmac('sha256', apiSecret)
        .update(passphrase)
        .digest('base64');

      const response = await axios.get(
        `https://api.kucoin.com${endpoint}`,
        {
          headers: {
            'KC-API-KEY': apiKey,
            'KC-API-SIGN': signature,
            'KC-API-TIMESTAMP': timestamp.toString(),
            'KC-API-PASSPHRASE': passphraseEncrypted,
            'KC-API-KEY-VERSION': '2'
          }
        }
      );

      this.recordActivity({
        exchange: 'KuCoin',
        timestamp: new Date(),
        action: 'balance_check',
        success: true
      });

    } catch (error: any) {
      if (error.response?.status === 403) {
        // This might indicate IP restriction working properly
        logger.info('KuCoin API access restricted (good if IP whitelist enabled)');
      }
    }
  }

  private async checkZebPayActivity() {
    try {
      const apiKey = process.env.ZEBPAY_API_KEY;
      const apiSecret = process.env.ZEBPAY_API_SECRET;
      
      if (!apiKey || !apiSecret) return;

      const timestamp = Date.now();
      const method = 'GET';
      const path = '/api/v1/user/activity';
      const body = '';
      
      const message = method + path + body + timestamp;
      const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(message)
        .digest('hex');

      const response = await axios.get(
        `https://api.zebpay.com${path}`,
        {
          headers: {
            'X-API-KEY': apiKey,
            'X-SIGNATURE': signature,
            'X-TIMESTAMP': timestamp.toString()
          }
        }
      );

      // Check recent activities
      const activities = response.data.data || [];
      const recentUnknown = activities.filter((act: any) => {
        const actTime = new Date(act.timestamp);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return actTime > hourAgo && !this.allowedIPs.has(act.ip);
      });

      if (recentUnknown.length > 0) {
        this.raiseSuspiciousActivity('ZebPay', `Unknown IP access: ${recentUnknown[0].ip}`);
      }

    } catch (error: any) {
      logger.debug('ZebPay activity check:', error.message);
    }
  }

  private recordActivity(activity: APIActivity) {
    this.activities.push(activity);
    
    // Keep only last 1000 activities
    if (this.activities.length > 1000) {
      this.activities = this.activities.slice(-1000);
    }
  }

  private analyzeActivities() {
    const recentActivities = this.activities.filter(act => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return act.timestamp > fiveMinutesAgo;
    });

    // Look for patterns
    const failureRate = recentActivities.filter(a => !a.success).length / recentActivities.length;
    if (failureRate > 0.5 && recentActivities.length > 10) {
      this.raiseSuspiciousActivity('Multiple', 'High API failure rate detected');
    }
  }

  private async raiseSuspiciousActivity(exchange: string, reason: string) {
    this.suspiciousActivityCount++;
    
    const alert = `🚨 API SECURITY ALERT 🚨
Exchange: ${exchange}
Reason: ${reason}
Time: ${new Date().toLocaleString()}
Alert #${this.suspiciousActivityCount}

Action Required: Check your ${exchange} account immediately!`;

    logger.error(alert);
    
    // Send Telegram alert
    if (process.env.TELEGRAM_ENABLED === 'true') {
      await telegramNotifier.sendMessage(alert);
    }

    this.emit('suspicious_activity', { exchange, reason });
  }

  async testSecurity(): Promise<{ secure: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check if keys have withdrawal permissions
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = crypto
        .createHmac('sha256', process.env.BINANCE_API_SECRET!)
        .update(queryString)
        .digest('hex');

      const response = await axios.get(
        `https://api.binance.com/sapi/v1/account/apiRestrictions?${queryString}&signature=${signature}`,
        {
          headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY }
        }
      );

      if (response.data.enableWithdrawals) {
        issues.push('Binance API key has withdrawal permissions enabled!');
      }
    } catch (error) {
      // Ignore
    }

    // Check for default passwords
    if (process.env.DB_PASSWORD === 'your_postgres_password') {
      issues.push('Using default database password');
    }

    return {
      secure: issues.length === 0,
      issues
    };
  }
}

export const apiSecurityMonitor = new APISecurityMonitor();