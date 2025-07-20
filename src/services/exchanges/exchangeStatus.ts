// Exchange status and restrictions tracker
export const exchangeStatus = {
  coindcx: {
    name: 'CoinDCX',
    depositsEnabled: true,
    withdrawalsEnabled: false,
    reason: 'Security incident - withdrawals suspended',
    lastUpdated: '2025-01-21',
    alternatives: ['zebpay', 'kucoin', 'binance_p2p']
  },
  wazirx: {
    name: 'WazirX',
    depositsEnabled: false,
    withdrawalsEnabled: false,
    reason: 'Banned in India',
    lastUpdated: '2025-01-21',
    alternatives: ['zebpay', 'coindcx', 'binance_p2p']
  },
  zebpay: {
    name: 'ZebPay',
    depositsEnabled: true,
    withdrawalsEnabled: true,
    reason: 'Fully operational',
    lastUpdated: '2025-01-21',
    restrictions: 'May require virtual account for instant deposits'
  },
  binance: {
    name: 'Binance',
    depositsEnabled: true,
    withdrawalsEnabled: true,
    reason: 'Fully operational for P2P',
    lastUpdated: '2025-01-21',
    restrictions: 'Spot trading not available in India, P2P only'
  },
  kucoin: {
    name: 'KuCoin',
    depositsEnabled: true,
    withdrawalsEnabled: true,
    reason: 'Fully operational',
    lastUpdated: '2025-01-21',
    restrictions: 'No INR pairs, need to use USDT/USDC'
  }
};

export function canWithdraw(exchange: string): boolean {
  return exchangeStatus[exchange.toLowerCase()]?.withdrawalsEnabled || false;
}

export function getWorkingExchanges(): string[] {
  return Object.entries(exchangeStatus)
    .filter(([_, status]) => status.withdrawalsEnabled)
    .map(([exchange, _]) => exchange);
}