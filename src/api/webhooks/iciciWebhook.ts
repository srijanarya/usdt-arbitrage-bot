import express from 'express';
import { iciciPaymentService } from '../../services/payment/iciciPaymentService';
import { logger } from '../../utils/logger';

const router = express.Router();

// ICICI Bank webhook endpoint
router.post('/webhook/icici/payment-status', async (req, res) => {
  try {
    const signature = req.headers['x-icici-signature'] as string;
    
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    // Process webhook
    await iciciPaymentService.handleWebhook(req.body, signature);
    
    // Log webhook data
    logger.info('ICICI webhook received:', {
      transactionId: req.body.transactionId,
      status: req.body.status,
      amount: req.body.amount
    });
    
    // Handle different payment statuses
    switch (req.body.status) {
      case 'SUCCESS':
        // Payment successful - trigger crypto purchase
        logger.info(`Payment successful: ₹${req.body.amount}`);
        // TODO: Trigger exchange buy order
        break;
        
      case 'FAILED':
        // Payment failed - notify and retry logic
        logger.error(`Payment failed: ${req.body.transactionId}`);
        // TODO: Implement retry logic
        break;
        
      case 'PENDING':
        // Payment pending - wait for final status
        logger.info(`Payment pending: ${req.body.transactionId}`);
        break;
    }
    
    // Acknowledge webhook
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed' 
    });
    
  } catch (error) {
    logger.error('Webhook processing failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Webhook processing failed' 
    });
  }
});

// Health check endpoint for ICICI
router.get('/webhook/icici/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;