import express from 'express';
import cors from 'cors';
import { P2PWorkflowOrchestrator } from '../services/automation/p2pWorkflowOrchestrator';
import { logger } from '../utils/logger';

// Global orchestrator instance
let orchestrator: P2PWorkflowOrchestrator | null = null;

export function createP2PApiServer(workflowOrchestrator: P2PWorkflowOrchestrator) {
    const app = express();
    orchestrator = workflowOrchestrator;

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Request logging
    app.use((req, res, next) => {
        logger.info(`API ${req.method} ${req.path}`, req.body);
        next();
    });

    // Execute P2P trade
    app.post('/api/p2p/execute', async (req, res) => {
        try {
            const { exchange, amount, price, type, paymentMethod, autoRelease } = req.body;

            if (!orchestrator) {
                return res.status(503).json({ error: 'P2P system not initialized' });
            }

            logger.info(`🚀 API: Creating P2P ${type} order`, {
                exchange,
                amount,
                price,
                paymentMethod
            });

            // Create the order
            const order = await orchestrator.createArbitrageOrder({
                buyExchange: 'market',
                sellExchange: exchange,
                buyPrice: price * 0.99, // Approximate buy price
                sellPrice: price,
                spread: price * 0.01,
                profitPercent: 1.0,
                amount: amount
            });

            if (!order) {
                return res.status(400).json({
                    success: false,
                    error: 'Order creation blocked - check trading mode or limits'
                });
            }

            res.json({
                success: true,
                orderId: order.id,
                exchange: order.exchange,
                amount: order.amount,
                price: order.price,
                status: order.status,
                message: 'P2P order created successfully'
            });

        } catch (error) {
            logger.error('❌ API: Failed to execute trade:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to execute trade'
            });
        }
    });

    // Get order status
    app.get('/api/p2p/orders/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;

            if (!orchestrator) {
                return res.status(503).json({ error: 'P2P system not initialized' });
            }

            const order = orchestrator.getOrder(orderId);
            
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            res.json({
                success: true,
                order: {
                    id: order.id,
                    exchange: order.exchange,
                    amount: order.amount,
                    price: order.price,
                    status: order.status,
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt,
                    paymentReceived: order.paymentReceived,
                    expectedAmount: order.expectedAmount,
                    actualAmount: order.actualAmount
                }
            });

        } catch (error) {
            logger.error('❌ API: Failed to get order status:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get order status'
            });
        }
    });

    // Get active orders
    app.get('/api/p2p/orders', async (req, res) => {
        try {
            if (!orchestrator) {
                return res.status(503).json({ error: 'P2P system not initialized' });
            }

            const orders = orchestrator.getActiveOrders();
            
            res.json({
                success: true,
                orders: orders.map(order => ({
                    id: order.id,
                    exchange: order.exchange,
                    amount: order.amount,
                    price: order.price,
                    status: order.status,
                    createdAt: order.createdAt,
                    expectedAmount: order.expectedAmount,
                    paymentReceived: order.paymentReceived
                }))
            });

        } catch (error) {
            logger.error('❌ API: Failed to get orders:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get orders'
            });
        }
    });

    // Cancel order
    app.post('/api/p2p/orders/:orderId/cancel', async (req, res) => {
        try {
            const { orderId } = req.params;

            if (!orchestrator) {
                return res.status(503).json({ error: 'P2P system not initialized' });
            }

            const success = await orchestrator.cancelOrder(orderId);
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Order cancelled successfully'
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'Failed to cancel order'
                });
            }

        } catch (error) {
            logger.error('❌ API: Failed to cancel order:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to cancel order'
            });
        }
    });

    // Manual release
    app.post('/api/p2p/orders/:orderId/release', async (req, res) => {
        try {
            const { orderId } = req.params;
            const { reason } = req.body;

            if (!orchestrator) {
                return res.status(503).json({ error: 'P2P system not initialized' });
            }

            const success = await orchestrator.manuallyCompleteOrder(orderId, reason || 'Manual release');
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Order released successfully'
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'Failed to release order'
                });
            }

        } catch (error) {
            logger.error('❌ API: Failed to release order:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to release order'
            });
        }
    });

    // System status
    app.get('/api/system/status', async (req, res) => {
        try {
            if (!orchestrator) {
                return res.status(503).json({ error: 'P2P system not initialized' });
            }

            const status = orchestrator.getSystemStatus();
            const tradingModes = orchestrator.getTradingModeSummary();
            
            res.json({
                success: true,
                status: {
                    ...status,
                    tradingModes
                }
            });

        } catch (error) {
            logger.error('❌ API: Failed to get system status:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get system status'
            });
        }
    });

    // Get pending approvals
    app.get('/api/trading/approvals', async (req, res) => {
        try {
            if (!orchestrator) {
                return res.status(503).json({ error: 'P2P system not initialized' });
            }

            const approvals = orchestrator.getPendingApprovals();
            
            res.json({
                success: true,
                approvals
            });

        } catch (error) {
            logger.error('❌ API: Failed to get approvals:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get approvals'
            });
        }
    });

    // Approve or reject trade
    app.post('/api/trading/approvals/:approvalId', async (req, res) => {
        try {
            const { approvalId } = req.params;
            const { approved, reason } = req.body;

            if (!orchestrator) {
                return res.status(503).json({ error: 'P2P system not initialized' });
            }

            const success = await orchestrator.approveTradeManually(approvalId, approved, reason);
            
            res.json({
                success,
                message: success ? 'Trade approved' : 'Trade approval failed'
            });

        } catch (error) {
            logger.error('❌ API: Failed to process approval:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process approval'
            });
        }
    });

    // Set exchange trading mode
    app.post('/api/trading/mode/:exchange', async (req, res) => {
        try {
            const { exchange } = req.params;
            const { mode } = req.body;

            if (!orchestrator) {
                return res.status(503).json({ error: 'P2P system not initialized' });
            }

            if (mode === 'fully_automated') {
                orchestrator.enableFullAutomationForExchange(exchange);
            } else if (mode === 'semi_assisted') {
                orchestrator.enableSemiAssistedForExchange(exchange);
            } else {
                return res.status(400).json({ error: 'Invalid trading mode' });
            }
            
            res.json({
                success: true,
                message: `Trading mode set to ${mode} for ${exchange}`
            });

        } catch (error) {
            logger.error('❌ API: Failed to set trading mode:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to set trading mode'
            });
        }
    });

    // Wallet transfer endpoint
    app.post('/api/wallet/transfer', async (req, res) => {
        try {
            const { fromExchange, toExchange, amount, network } = req.body;

            if (!fromExchange || !toExchange || !amount) {
                return res.status(400).json({ 
                    error: 'Missing required fields: fromExchange, toExchange, amount' 
                });
            }

            // Import wallet transfer service
            const { walletTransferService } = await import('../services/wallet/walletTransferService');

            const result = await walletTransferService.transferUSDT({
                fromExchange,
                toExchange,
                amount,
                currency: 'USDT',
                network: network || 'TRC20'
            });

            res.json({
                success: result.success,
                result
            });

        } catch (error) {
            logger.error('❌ API: Wallet transfer failed:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Transfer failed'
            });
        }
    });

    // Get deposit address
    app.get('/api/wallet/deposit/:exchange/:currency', async (req, res) => {
        try {
            const { exchange, currency } = req.params;
            const { network } = req.query;

            res.json({
                success: true,
                message: `Get deposit address for ${currency} on ${exchange}`,
                info: 'Use the exchange app to get your deposit address',
                network: network || 'TRC20'
            });

        } catch (error) {
            logger.error('❌ API: Failed to get deposit address:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get deposit address'
            });
        }
    });

    // Auto-listing endpoints
    app.get('/api/auto-listing/status', async (req, res) => {
        try {
            const { autoListingManager } = await import('../services/p2p/autoListingManager');
            const status = autoListingManager.getStatus();
            res.json({
                success: true,
                ...status
            });
        } catch (error) {
            logger.error('❌ API: Failed to get auto-listing status:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get status'
            });
        }
    });

    app.post('/api/auto-listing/start', async (req, res) => {
        try {
            const { autoListingManager } = await import('../services/p2p/autoListingManager');
            await autoListingManager.start();
            res.json({
                success: true,
                message: 'Auto-listing started'
            });
        } catch (error) {
            logger.error('❌ API: Failed to start auto-listing:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to start auto-listing'
            });
        }
    });

    app.post('/api/auto-listing/stop', async (req, res) => {
        try {
            const { autoListingManager } = await import('../services/p2p/autoListingManager');
            autoListingManager.stop();
            res.json({
                success: true,
                message: 'Auto-listing stopped'
            });
        } catch (error) {
            logger.error('❌ API: Failed to stop auto-listing:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to stop auto-listing'
            });
        }
    });

    app.post('/api/auto-listing/config', async (req, res) => {
        try {
            const { autoListingManager } = await import('../services/p2p/autoListingManager');
            const config = req.body;
            autoListingManager.updateConfig(config);
            res.json({
                success: true,
                message: 'Configuration updated',
                config: autoListingManager.getStatus().config
            });
        } catch (error) {
            logger.error('❌ API: Failed to update config:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to update configuration'
            });
        }
    });

    // Test payment simulation
    app.post('/api/p2p/orders/:orderId/simulate-payment', async (req, res) => {
        try {
            const { orderId } = req.params;
            const { amount } = req.body;

            if (!orchestrator) {
                return res.status(503).json({ error: 'P2P system not initialized' });
            }

            const result = await orchestrator.simulatePayment(orderId, amount || 1500);
            
            res.json({
                success: true,
                result,
                message: 'Payment simulation completed'
            });

        } catch (error) {
            logger.error('❌ API: Failed to simulate payment:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to simulate payment'
            });
        }
    });

    // Error handling
    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logger.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    });

    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: 'API endpoint not found'
        });
    });

    return app;
}

export function startP2PApiServer(orchestrator: P2PWorkflowOrchestrator, port: number = 3001) {
    const app = createP2PApiServer(orchestrator);
    
    const server = app.listen(port, () => {
        logger.info(`🌐 P2P API Server started on http://localhost:${port}`);
        logger.info('📋 Available endpoints:');
        logger.info('   POST /api/p2p/execute - Execute P2P trade');
        logger.info('   GET  /api/p2p/orders/:id - Get order status');
        logger.info('   GET  /api/p2p/orders - Get active orders');
        logger.info('   POST /api/p2p/orders/:id/cancel - Cancel order');
        logger.info('   POST /api/p2p/orders/:id/release - Manual release');
        logger.info('   GET  /api/system/status - System status');
        logger.info('   POST /api/p2p/orders/:id/simulate-payment - Test payment');
    });

    return server;
}