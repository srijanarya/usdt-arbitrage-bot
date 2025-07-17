import { config } from 'dotenv';
import { logger } from '../utils/logger';

config();

// IMMEDIATE SAFETY MEASURES FOR PRIMARY ACCOUNT
export const PRIMARY_ACCOUNT_SAFETY = {
  // STRICT LIMITS - START VERY SMALL
  limits: {
    maxPerTransaction: 2000,     // Only ₹2,000 per transaction initially
    dailyLimit: 10000,          // Only ₹10,000 per day
    monthlyLimit: 100000,       // Only ₹1 lakh per month
    
    // Gradual increase schedule
    week1: { perTx: 2000, daily: 10000 },
    week2: { perTx: 3000, daily: 15000 },
    week3: { perTx: 5000, daily: 25000 },
    week4: { perTx: 10000, daily: 50000 }
  },
  
  // TIME RESTRICTIONS
  timeRestrictions: {
    allowedHours: { start: 10, end: 22 },  // 10 AM to 10 PM only
    blockedDays: [0],                       // No Sundays initially
    minGapBetweenTx: 600,                   // 10 minutes gap minimum
    maxTransactionsPerHour: 3               // Max 3 transactions per hour
  },
  
  // WHITELISTED RECIPIENTS ONLY
  whitelist: {
    exchanges: [
      { name: "Binance", upi: "binance@axisbank", maxAmount: 5000 },
      { name: "WazirX", upi: "wazirx@axisbank", maxAmount: 5000 },
      { name: "ZebPay", upi: "zebpay@axisbank", maxAmount: 3000 },
      { name: "CoinDCX", upi: "coindcx@axisbank", maxAmount: 3000 }
    ],
    
    // Start with only 2 exchanges
    initiallyEnabled: ["Binance", "WazirX"]
  },
  
  // MANDATORY APPROVALS
  approvals: {
    alwaysRequireOTP: true,              // OTP for every transaction
    require2FA: true,                    // 2FA for amounts > ₹1000
    manualApprovalAbove: 5000,           // Manual approval > ₹5000
    photoVerificationAbove: 10000        // Selfie verification > ₹10000
  },
  
  // MONITORING & ALERTS
  monitoring: {
    alertChannels: ["SMS", "Email", "WhatsApp", "Phone Call"],
    
    alerts: [
      { trigger: "Any transaction", notify: ["SMS", "Email"] },
      { trigger: "Transaction > ₹2000", notify: ["SMS", "Email", "WhatsApp"] },
      { trigger: "Daily limit 50% reached", notify: ["Email", "WhatsApp"] },
      { trigger: "Unusual pattern", notify: ["SMS", "Phone Call"] },
      { trigger: "Failed transaction", notify: ["SMS", "Email", "Phone Call"] }
    ],
    
    dashboardUrl: "http://localhost:3000/primary-account-monitor"
  }
};

// STEP-BY-STEP SETUP GUIDE
export const SETUP_STEPS = [
  {
    step: 1,
    title: "Enable Axis Bank Security Features",
    tasks: [
      "Login to Axis Mobile/Net Banking",
      "Go to Security Settings",
      "Enable SMS alerts for ALL transactions",
      "Set daily limit to ₹10,000",
      "Enable login alerts",
      "Enable beneficiary addition alerts",
      "Set cooling period for new beneficiaries (24 hours)"
    ]
  },
  {
    step: 2,
    title: "Create Dedicated UPI for Crypto",
    tasks: [
      "Open Google Pay/PhonePe/Paytm",
      "Create new UPI ID: yourcrypto@axisbank",
      "Set transaction limit: ₹5,000",
      "Enable PIN for all transactions",
      "Turn on biometric authentication"
    ]
  },
  {
    step: 3,
    title: "Add Exchange Beneficiaries",
    tasks: [
      "Add Binance UPI: binance@axisbank",
      "Add WazirX UPI: wazirx@axisbank", 
      "Wait 24 hours (cooling period)",
      "Test with ₹100 transaction",
      "Save beneficiaries for quick access"
    ]
  },
  {
    step: 4,
    title: "Setup Transaction Rules",
    tasks: [
      "Set max ₹2,000 per transaction",
      "Set max ₹10,000 daily limit",
      "Enable OTP for all crypto transactions",
      "Block international transactions",
      "Enable transaction time restrictions"
    ]
  },
  {
    step: 5,
    title: "Install Monitoring",
    tasks: [
      "Run: npm run monitor:primary",
      "Setup Telegram alerts",
      "Configure email notifications",
      "Test alert system",
      "Create transaction log"
    ]
  }
];

// SAFE TRANSACTION FLOW
export async function executeSafePrimaryTransaction(amount: number, exchange: string) {
  console.log('\n🔒 PRIMARY ACCOUNT SAFE TRANSACTION');
  console.log('━'.repeat(50));
  
  // Check 1: Amount limits
  if (amount > PRIMARY_ACCOUNT_SAFETY.limits.maxPerTransaction) {
    console.log(`❌ BLOCKED: Amount ₹${amount} exceeds limit of ₹${PRIMARY_ACCOUNT_SAFETY.limits.maxPerTransaction}`);
    return false;
  }
  
  // Check 2: Time restrictions
  const now = new Date();
  const hour = now.getHours();
  if (hour < PRIMARY_ACCOUNT_SAFETY.timeRestrictions.allowedHours.start || 
      hour > PRIMARY_ACCOUNT_SAFETY.timeRestrictions.allowedHours.end) {
    console.log(`❌ BLOCKED: Transactions only allowed 10 AM - 10 PM`);
    return false;
  }
  
  // Check 3: Whitelist
  const whitelisted = PRIMARY_ACCOUNT_SAFETY.whitelist.exchanges.find(
    ex => ex.name === exchange && PRIMARY_ACCOUNT_SAFETY.whitelist.initiallyEnabled.includes(ex.name)
  );
  
  if (!whitelisted) {
    console.log(`❌ BLOCKED: ${exchange} not in whitelist or not enabled`);
    return false;
  }
  
  if (amount > whitelisted.maxAmount) {
    console.log(`❌ BLOCKED: Amount exceeds ${exchange} limit of ₹${whitelisted.maxAmount}`);
    return false;
  }
  
  // Check 4: Show approval requirements
  console.log('\n✅ Transaction approved for processing');
  console.log('\n📋 Required approvals:');
  console.log('1. Enter UPI PIN');
  console.log('2. Enter OTP sent to registered mobile');
  if (amount > 1000) console.log('3. Complete 2FA verification');
  if (amount > 5000) console.log('4. Manual approval in Axis app');
  
  console.log('\n⚠️  IMPORTANT REMINDERS:');
  console.log('- This is your PRIMARY account');
  console.log('- Check SMS/Email alerts immediately');
  console.log('- Report any unauthorized transaction');
  console.log('- Consider opening dedicated account soon');
  
  return true;
}

// MIGRATION TIMELINE
export const MIGRATION_TIMELINE = {
  week1: {
    goal: "Test with minimal amounts",
    limits: { perTx: 2000, daily: 10000 },
    actions: [
      "Complete 10 test transactions",
      "Monitor all alerts",
      "Document any issues",
      "Build transaction history"
    ]
  },
  
  week2: {
    goal: "Open dedicated account",
    actions: [
      "Visit Axis Bank branch",
      "Open Current/Savings account for trading",
      "Get debit card and activate",
      "Setup online banking",
      "Create crypto-specific UPI"
    ]
  },
  
  week3: {
    goal: "Transition to dedicated account",
    actions: [
      "Transfer ₹50,000 to dedicated account",
      "Update exchange beneficiaries",
      "Test transactions",
      "Keep primary account as backup only"
    ]
  },
  
  week4: {
    goal: "Full automation on dedicated account",
    actions: [
      "Apply for API access",
      "Increase limits gradually",
      "Setup automated workflows",
      "Primary account completely isolated"
    ]
  }
};

// EMERGENCY PROCEDURES
export const EMERGENCY_PROCEDURES = {
  suspiciousActivity: [
    "1. Immediately freeze UPI in Axis app",
    "2. Call Axis Bank: 1860-419-5555",
    "3. Check all recent transactions",
    "4. Change all passwords",
    "5. File complaint if needed"
  ],
  
  apiCompromise: [
    "1. Revoke all API access",
    "2. Change all API keys",
    "3. Enable additional OTP",
    "4. Block all beneficiaries",
    "5. Switch to manual mode"
  ],
  
  contacts: {
    axisBank: "1860-419-5555",
    cyberCrime: "1930",
    email: "support@axisbank.com"
  }
};

// Display safety setup
if (require.main === module) {
  console.log('🛡️ PRIMARY ACCOUNT SAFETY SETUP\n');
  
  console.log('⚠️  CURRENT LIMITS (VERY CONSERVATIVE):');
  console.log(`- Max per transaction: ₹${PRIMARY_ACCOUNT_SAFETY.limits.maxPerTransaction}`);
  console.log(`- Daily limit: ₹${PRIMARY_ACCOUNT_SAFETY.limits.dailyLimit}`);
  console.log(`- Monthly limit: ₹${PRIMARY_ACCOUNT_SAFETY.limits.monthlyLimit}`);
  
  console.log('\n📋 SETUP CHECKLIST:');
  SETUP_STEPS.forEach(step => {
    console.log(`\n${step.step}. ${step.title}`);
    step.tasks.forEach(task => console.log(`   ✓ ${task}`));
  });
  
  console.log('\n⏱️ MIGRATION TIMELINE:');
  Object.entries(MIGRATION_TIMELINE).forEach(([week, details]) => {
    console.log(`\n${week.toUpperCase()}: ${details.goal}`);
    if (details.limits) {
      console.log(`   Limits: ₹${details.limits.perTx}/tx, ₹${details.limits.daily}/day`);
    }
    details.actions.forEach(action => console.log(`   - ${action}`));
  });
  
  console.log('\n🚨 EMERGENCY CONTACTS:');
  console.log(`Axis Bank: ${EMERGENCY_PROCEDURES.contacts.axisBank}`);
  console.log(`Cyber Crime: ${EMERGENCY_PROCEDURES.contacts.cyberCrime}`);
  
  console.log('\n✅ Remember: Start VERY small and increase gradually!');
}