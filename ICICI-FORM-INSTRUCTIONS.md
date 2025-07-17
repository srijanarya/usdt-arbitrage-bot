# 🎯 ICICI API FORM - QUICK FILL INSTRUCTIONS

Since Chrome automation needs special setup, here's exactly what to check/fill on your form:

## ✅ CHECKBOXES TO SELECT (Check ALL of these):

### Payment APIs Section:
- [ ] **UPI Payment API**
- [ ] **UPI Collections**  
- [ ] **IMPS Transfer API**
- [ ] **NEFT/RTGS API**
- [ ] **Payment Status Inquiry**
- [ ] **Fund Transfer API**

### Account Services Section:
- [ ] **Balance Inquiry API**
- [ ] **Account Statement API**
- [ ] **Transaction History API**
- [ ] **Account Details API**

### Notification Section:
- [ ] **Webhook Notifications**
- [ ] **Real-time Alerts**
- [ ] **Payment Callbacks**
- [ ] **Transaction Status Updates**

## 📝 TEXT FIELDS TO FILL:

### Use Case Description (Copy & Paste):
```
Automated payment processing for online trading activities. Need to make time-sensitive payments to verified exchange merchants for investment opportunities. All recipients are KYC-verified Indian entities.

Technical Requirements:
- UPI/IMPS payment APIs for instant transfers
- Balance inquiry for fund availability
- Payment status webhooks for confirmation
- Transaction history for reconciliation

All transactions are to regulated Indian platforms with complete audit trail.
```

### Business Type:
Select: **Individual Trader** or **Proprietary Trading**

### Transaction Volume:
- Monthly Volume: **2000000**
- Daily Transactions: **50**
- Average Transaction Size: **10000**
- Maximum Transaction: **50000**
- Expected Growth: **5000000** (6 months)

## 🚀 TO ENABLE AUTOMATION:

If you want me to fill it automatically:

1. **Close all Chrome windows**

2. **Open Terminal and run:**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

3. **Navigate to ICICI form**

4. **Run:**
```bash
npm run icici:fill
```

## 📋 FINAL CHECKLIST:

Before submitting:
- [ ] All payment APIs selected
- [ ] Use case filled
- [ ] Volume details filled
- [ ] Business type selected
- [ ] PAN uploaded
- [ ] Aadhaar uploaded
- [ ] Contact details verified

## 💡 After Submission:

1. **Save the reference number**
2. **Email:** connectedbanking@icicibank.com
3. **Subject:** API Access Request - Ref: [Your Reference Number]
4. **Follow up in 2-3 days**

That's it! The form should take about 5 minutes to complete manually with these instructions.