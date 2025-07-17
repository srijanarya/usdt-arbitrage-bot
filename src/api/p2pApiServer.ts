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
            
            res.json({
                success: true,
                status
            });

        } catch (error) {
            logger.error('❌ API: Failed to get system status:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get system status'
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