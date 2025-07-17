console.log('🏦 ICICI API FORM - FIELD-BY-FIELD GUIDE\n');
console.log('Since you have the tab open, here\'s what to fill in each field:\n');

console.log('══════════════════════════════════════════════════════════');
console.log('BASIC INFORMATION');
console.log('══════════════════════════════════════════════════════════\n');

console.log('✅ Account Number: [Already filled by you]');
console.log('📝 Customer Name: [Your name as per bank records]');
console.log('📝 Email: [Your registered email]');
console.log('📝 Mobile: [Your registered mobile]\n');

console.log('══════════════════════════════════════════════════════════');
console.log('BUSINESS DETAILS');
console.log('══════════════════════════════════════════════════════════\n');

console.log('📝 Business Type: Select "Individual Trader" or "Proprietary"');
console.log('📝 Industry/Sector: Select "Financial Services" > "Trading"');
console.log('📝 Annual Turnover: ₹10,00,000 - ₹50,00,000\n');

console.log('══════════════════════════════════════════════════════════');
console.log('USE CASE (Copy & Paste This)');
console.log('══════════════════════════════════════════════════════════\n');

const useCase = `Automated payment processing for online trading activities on regulated Indian platforms. 

Purpose:
- Execute time-sensitive INR payments to exchange merchant accounts
- All recipients are KYC-verified Indian entities (WazirX, CoinDCX, ZebPay)
- Require real-time payment execution for trading opportunities

Technical Requirements:
- UPI/IMPS payment APIs for instant transfers
- Balance inquiry for fund availability
- Payment status webhooks for confirmation
- Transaction history for reconciliation

Compliance:
- All transactions to whitelisted merchant accounts only
- Complete audit trail maintained
- Tax compliant with PAN linked transactions`;

console.log(useCase);

console.log('\n══════════════════════════════════════════════════════════');
console.log('API SELECTION (Check these boxes)');
console.log('══════════════════════════════════════════════════════════\n');

console.log('PAYMENT APIs:');
console.log('☑️  UPI Payment API');
console.log('☑️  IMPS Transfer API');
console.log('☑️  NEFT/RTGS API (optional)');
console.log('☑️  Payment Status API');
console.log('☑️  Bulk Payment API\n');

console.log('ACCOUNT APIs:');
console.log('☑️  Balance Inquiry API');
console.log('☑️  Account Statement API');
console.log('☑️  Transaction Status API');
console.log('☑️  Transaction History API\n');

console.log('NOTIFICATION APIs:');
console.log('☑️  Webhook Notifications');
console.log('☑️  Real-time Alerts');
console.log('☑️  Payment Confirmation API\n');

console.log('══════════════════════════════════════════════════════════');
console.log('TRANSACTION VOLUME');
console.log('══════════════════════════════════════════════════════════\n');

console.log('📝 Current Monthly Volume: ₹20,00,000');
console.log('📝 Expected Monthly Volume (6 months): ₹50,00,000');
console.log('📝 Daily Transactions: 50-100');
console.log('📝 Average Transaction Size: ₹10,000');
console.log('📝 Maximum Transaction Size: ₹50,000');
console.log('📝 Minimum Transaction Size: ₹1,000\n');

console.log('══════════════════════════════════════════════════════════');
console.log('TECHNICAL DETAILS');
console.log('══════════════════════════════════════════════════════════\n');

console.log('📝 Integration Type: REST API');
console.log('📝 Authentication: OAuth 2.0');
console.log('📝 Callback URL: https://your-domain.com/webhook/icici');
console.log('📝 IP Address for Whitelisting: [Your server IP]');
console.log('📝 Development Environment: Node.js/Python\n');

console.log('══════════════════════════════════════════════════════════');
console.log('BENEFICIARY DETAILS (Main Exchanges)');
console.log('══════════════════════════════════════════════════════════\n');

console.log('1. WazirX');
console.log('   Company: Zanmai Labs Pvt Ltd');
console.log('   VPA: wazirx@icici\n');

console.log('2. CoinDCX');
console.log('   Company: Neblio Technologies Pvt Ltd');
console.log('   VPA: coindcx@icici\n');

console.log('3. ZebPay');
console.log('   Company: Awlencan Innovations India Pvt Ltd');
console.log('   VPA: zebpay@icici\n');

console.log('══════════════════════════════════════════════════════════');
console.log('DOCUMENTS TO UPLOAD');
console.log('══════════════════════════════════════════════════════════\n');

console.log('📎 PAN Card (JPEG/PDF)');
console.log('📎 Aadhaar Card (JPEG/PDF)');
console.log('📎 Bank Statement (Last 3 months)');
console.log('📎 Business Description (1-page PDF) - Optional but helpful\n');

console.log('══════════════════════════════════════════════════════════');
console.log('FINAL CHECKLIST');
console.log('══════════════════════════════════════════════════════════\n');

console.log('Before submitting:');
console.log('✓ All mandatory fields filled');
console.log('✓ APIs selected (minimum: UPI, Balance, Status)');
console.log('✓ Use case clearly explains trading payments');
console.log('✓ Volume projections are realistic');
console.log('✓ Documents uploaded');
console.log('✓ Contact details are correct\n');

console.log('💡 PRO TIP: After submitting, immediately email');
console.log('connectedbanking@icicibank.com with your application');
console.log('reference number to expedite processing!\n');