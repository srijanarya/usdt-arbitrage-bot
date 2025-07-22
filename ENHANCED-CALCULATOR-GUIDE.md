# Enhanced Arbitrage Calculator Guide

## Overview

The enhanced arbitrage calculator now includes comprehensive payment method compatibility checks, P2P merchant requirements validation, and minimum order validations. This ensures that only viable trading opportunities are presented.

## New Features

### 1. Payment Method Compatibility
- Automatically checks if user's payment methods match merchant's accepted methods
- Validates order amounts against payment method limits
- Supports: UPI, Bank Transfer, IMPS, NEFT, RTGS, PayPal, Paytm

### 2. Merchant Requirements Validation
- Checks minimum completed orders
- Verifies completion rate thresholds
- Validates KYC requirements
- Ensures merchant meets quality standards

### 3. Minimum Order Validation
- Validates if order amount meets merchant's minimum
- Converts between INR and USDT minimums automatically
- Provides clear feedback on why orders fail

### 4. Enhanced Profit Analysis
- Includes payment compatibility in profitability assessment
- Filters out incompatible merchants automatically
- Provides detailed reasons for rejections

## Usage Examples

### Basic Profit Calculation with Merchant
```typescript
import { arbitrageCalculator, P2PMerchant } from './services/arbitrage/USDTArbitrageCalculator';

const merchant: P2PMerchant = {
  id: 'merchant1',
  name: 'FastTrader',
  price: 90.50,
  minAmount: 1000,
  maxAmount: 50000,
  completedOrders: 5432,
  completionRate: 98.5,
  paymentMethods: ['UPI', 'IMPS'],
  platform: 'Binance P2P'
};

const analysis = arbitrageCalculator.calculateProfit(
  87.00,    // Buy price
  90.50,    // Sell price (merchant price)
  100,      // Amount in USDT
  'zebpay', // Exchange
  merchant  // P2P merchant
);

console.log(`Profitable: ${analysis.profitable}`);
console.log(`Payment Compatible: ${analysis.paymentMethodCompatible}`);
console.log(`Net Profit: ₹${analysis.netProfit.toFixed(2)}`);
```

### Finding Best Compatible Merchant
```typescript
const merchants = [...]; // Array of P2PMerchant objects
const buyPrice = 87.00;
const amount = 100;

const { merchant, analysis } = arbitrageCalculator.findBestMerchant(
  merchants,
  buyPrice,
  amount
);

if (merchant && analysis) {
  console.log(`Best merchant: ${merchant.name}`);
  console.log(`Expected profit: ₹${analysis.netProfit.toFixed(2)}`);
}
```

### Check Payment Compatibility
```typescript
const compatibility = arbitrageCalculator.checkPaymentCompatibility(
  merchant,
  orderAmount
);

if (compatibility.compatible) {
  console.log(`Compatible methods: ${compatibility.availableMethods.join(', ')}`);
} else {
  console.log(`Incompatible: ${compatibility.reason}`);
}
```

### Validate Merchant Requirements
```typescript
const requirements = arbitrageCalculator.checkMerchantRequirements(merchant);

if (!requirements.qualified) {
  console.log('Issues found:');
  requirements.issues.forEach(issue => console.log(`- ${issue}`));
}
```

## Configuration

### User Payment Methods
The calculator uses the payment configuration from `src/config/paymentConfig.ts`:
- UPI: ₹100 - ₹1,00,000
- Bank Transfer: ₹1,000 - ₹10,00,000  
- IMPS: ₹100 - ₹2,00,000

### Merchant Requirements
Default requirements checked:
- Minimum orders: 100
- Minimum completion rate: 95%
- KYC verification (if required)

## Running the Examples

### Test Enhanced Calculator
```bash
npm run script src/scripts/testEnhancedCalculator.ts
```

### Comprehensive Demo
```bash
npm run script src/scripts/comprehensiveCalculatorDemo.ts
```

### Enhanced Monitor with Payment Checks
```bash
npm run enhanced-monitor
```

## Integration with Existing Code

The enhanced calculator is fully backward compatible. Existing code will continue to work, with the new features being optional:

```typescript
// Old way (still works)
const analysis = arbitrageCalculator.calculateProfit(buyPrice, sellPrice, amount);

// New way (with merchant validation)
const analysis = arbitrageCalculator.calculateProfit(buyPrice, sellPrice, amount, 'zebpay', merchant);
```

## Benefits

1. **Reduced Failed Trades**: Only shows opportunities where payment methods match
2. **Quality Assurance**: Filters out low-quality merchants automatically
3. **Clear Feedback**: Provides specific reasons why opportunities are not viable
4. **Better Decision Making**: More accurate profit calculations considering all constraints

## Troubleshooting

### No Compatible Merchants Found
- Check if your payment methods match any merchants
- Verify order amount is within merchant limits
- Ensure merchants meet minimum quality requirements

### Payment Method Not Recognized
- Check the normalized payment method names in the calculator
- Add new payment method mappings if needed

### Order Below Minimum
- Calculator automatically checks minimum order requirements
- Shows exact minimum required for each merchant