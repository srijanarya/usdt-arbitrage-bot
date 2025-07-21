# Exchange API Integration Guide

## Overview
This guide explains how to integrate real exchange APIs to replace the simulated trading in AutomatedTradingService.ts

## Integration Points

### 1. ZebPay Integration
Location: `src/services/trading/AutomatedTradingService.ts` - `executeBuyOrder()` method

Replace the simulated code with:
```typescript
private async executeBuyOrder(trade: TradeExecution): Promise<void> {
  if (trade.exchange === 'zebpay') {
    const zebpayClient = new ZebPayClient(
      process.env.ZEBPAY_API_KEY,
      process.env.ZEBPAY_API_SECRET
    );
    
    const order = await zebpayClient.createOrder({
      pair: 'USDT-INR',
      type: 'buy',
      orderType: 'market',
      quantity: trade.amount
    });
    
    // Monitor order status
    await this.waitForOrderCompletion(zebpayClient, order.id);
  }
}
```

### 2. Binance P2P Integration
More complex as it requires:
- Browser automation for P2P trades
- Payment confirmation handling
- Merchant selection logic

### 3. USDT Transfer Integration
For transfers between exchanges:
```typescript
private async executeTransfer(from: string, to: string, amount: number): Promise<void> {
  // 1. Get deposit address from destination exchange
  const depositAddress = await this.getDepositAddress(to, 'USDT');
  
  // 2. Execute withdrawal from source exchange
  const withdrawal = await this.executeWithdrawal(from, {
    currency: 'USDT',
    amount: amount,
    address: depositAddress,
    network: 'TRC20' // or ERC20
  });
  
  // 3. Wait for blockchain confirmation
  await this.waitForTransferConfirmation(withdrawal.txId);
}
```

## Safety Checklist

Before enabling real trading:

1. **API Key Permissions**
   - [ ] Enable only required permissions (trade, read)
   - [ ] Disable withdrawal permissions initially
   - [ ] Use IP whitelisting if available

2. **Testing Protocol**
   - [ ] Test with minimum amounts (1-5 USDT)
   - [ ] Verify order creation and cancellation
   - [ ] Test error handling (insufficient balance, network errors)
   - [ ] Confirm fee calculations are accurate

3. **Gradual Rollout**
   - [ ] Start with one exchange pair
   - [ ] Monitor for 24 hours with small amounts
   - [ ] Gradually increase position sizes
   - [ ] Enable additional exchanges one by one

4. **Monitoring**
   - [ ] Set up alerts for failed trades
   - [ ] Monitor API rate limits
   - [ ] Track actual vs expected profits
   - [ ] Log all transactions for audit

## Exchange-Specific Notes

### ZebPay
- API Rate Limit: 100 requests per minute
- Market orders execute immediately
- Fees: 0.25% maker/taker
- Minimum order: 100 INR

### Binance P2P
- Requires browser automation (Playwright)
- 1% TDS on sell orders
- Payment window: 15 minutes
- Merchant verification important

### CoinDCX
- Currently disabled due to withdrawal issues
- Consider re-enabling after testing

## Error Handling

Implement these error handlers:
```typescript
try {
  await this.executeBuyOrder(trade);
} catch (error) {
  if (error.code === 'INSUFFICIENT_BALANCE') {
    // Handle insufficient balance
    await this.handleInsufficientBalance(trade);
  } else if (error.code === 'RATE_LIMIT') {
    // Handle rate limiting
    await this.handleRateLimit(trade);
  } else if (error.code === 'NETWORK_ERROR') {
    // Retry with exponential backoff
    await this.retryWithBackoff(trade);
  } else {
    // Unknown error - stop trading
    await this.emergencyStop();
    throw error;
  }
}
```

## Required Exchange Client Classes

Create these in `src/services/exchanges/`:
- `ZebPayClient.ts`
- `BinanceP2PClient.ts`
- `CoinDCXClient.ts`

Each should implement:
- Authentication
- Order creation/cancellation
- Balance checking
- Order status monitoring
- Error handling
- Rate limiting

## Next Steps

1. Choose one exchange to start with (recommend ZebPay)
2. Implement the exchange client class
3. Test with tiny amounts
4. Monitor closely for first 48 hours
5. Gradually enable other exchanges

Remember: Start small, test thoroughly, and scale gradually!