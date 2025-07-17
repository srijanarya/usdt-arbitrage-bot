export const paymentConfig = {
  upi: {
    id: process.env.UPI_ID || 'srijanaryay@okaxis',
    holderName: process.env.UPI_HOLDER_NAME || 'Srijan Arya',
    provider: 'Axis Bank'
  },
  
  banks: {
    primary: {
      name: 'ICICI Bank',
      status: 'awaiting_api_credentials',
      accountType: 'Savings'
    },
    secondary: {
      name: 'Axis Bank',
      upiId: 'srijanaryay@okaxis',
      status: 'active'
    }
  },
  
  limits: {
    minTransaction: 100,      // ₹100 minimum
    maxTransaction: 100000,   // ₹1,00,000 maximum
    dailyLimit: 1000000      // ₹10,00,000 daily
  },
  
  verification: {
    autoVerify: true,
    confidenceThreshold: 0.9,
    manualReviewThreshold: 0.7
  }
};

export const getPaymentDetails = () => ({
  upiId: paymentConfig.upi.id,
  accountHolderName: paymentConfig.upi.holderName,
  paymentMethods: ['UPI'],
  preferredMethod: 'UPI',
  bankName: paymentConfig.upi.provider
});