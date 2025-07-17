import express from 'express';
import { autoListingManager } from '../services/p2p/autoListingManager';
import { logger } from '../utils/logger';

const router = express.Router();

// Get auto-listing status
router.get('/auto-listing/status', (req, res) => {
  try {
    const status = autoListingManager.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('Failed to get auto-listing status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    });
  }
});

// Start auto-listing
router.post('/auto-listing/start', async (req, res) => {
  try {
    await autoListingManager.start();
    res.json({
      success: true,
      message: 'Auto-listing started'
    });
  } catch (error) {
    logger.error('Failed to start auto-listing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start auto-listing'
    });
  }
});

// Stop auto-listing
router.post('/auto-listing/stop', (req, res) => {
  try {
    autoListingManager.stop();
    res.json({
      success: true,
      message: 'Auto-listing stopped'
    });
  } catch (error) {
    logger.error('Failed to stop auto-listing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop auto-listing'
    });
  }
});

// Update configuration
router.post('/auto-listing/config', (req, res) => {
  try {
    const config = req.body;
    autoListingManager.updateConfig(config);
    res.json({
      success: true,
      message: 'Configuration updated',
      config: autoListingManager.getStatus().config
    });
  } catch (error) {
    logger.error('Failed to update config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

// Cancel specific order
router.post('/auto-listing/cancel/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await autoListingManager.cancelOrder(orderId);
    res.json({
      success: result,
      message: result ? 'Order cancelled' : 'Failed to cancel order'
    });
  } catch (error) {
    logger.error('Failed to cancel order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
});

// Get balance info
router.get('/auto-listing/balance', (req, res) => {
  try {
    const balance = autoListingManager.getBalance();
    res.json({
      success: true,
      balance
    });
  } catch (error) {
    logger.error('Failed to get balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balance'
    });
  }
});

export default router;