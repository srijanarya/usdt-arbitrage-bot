import { config } from 'dotenv';
import { P2PWorkflowOrchestrator, WorkflowConfig } from './services/automation/p2pWorkflowOrchestrator';
import { startP2PApiServer } from './api/p2pApiServer';
import { logger } from './utils/logger';

// Load environment variables
config();

async function initializeP2PAutomation() {
    try {
        logger.info('🚀 Initializing P2P Automation System...');

        // Validate required environment variables
        const requiredEnvVars = [
            'BINANCE_API_KEY', 'BINANCE_API_SECRET',
            'ZEBPAY_API_KEY', 'ZEBPAY_API_SECRET',
            'KUCOIN_API_KEY', 'KUCOIN_API_SECRET', 'KUCOIN_PASSPHRASE',
            'COINSWITCH_API_KEY', 'COINSWITCH_API_SECRET'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName] || process.env[varName] === 'your_api_key_here');
        
        if (missingVars.length > 0) {
            logger.warn('⚠️ Some API credentials are missing or not configured:');
            missingVars.forEach(varName => logger.warn(`   - ${varName}`));
            logger.warn('Please update your .env file with actual API credentials');
        }

        // Configure the P2P workflow
        const workflowConfig: WorkflowConfig = {
            exchanges: [
                {
                    name: 'binance',
                    apiKey: process.env.BINANCE_API_KEY || '',
                    apiSecret: process.env.BINANCE_API_SECRET || ''
                },
                {
                    name: 'zebpay',
                    apiKey: process.env.ZEBPAY_API_KEY || '',
                    apiSecret: process.env.ZEBPAY_API_SECRET || ''
                },
                {
                    name: 'kucoin',
                    apiKey: process.env.KUCOIN_API_KEY || '',
                    apiSecret: process.env.KUCOIN_API_SECRET || '',
                    passphrase: process.env.KUCOIN_PASSPHRASE || ''
                },
                {
                    name: 'coinswitch',
                    apiKey: process.env.COINSWITCH_API_KEY || '',
                    apiSecret: process.env.COINSWITCH_API_SECRET || ''
                }
            ],
            payment: {
                gmail: {
                    clientId: process.env.GMAIL_CLIENT_ID || '',
                    clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
                    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
                    redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/gmail/callback'
                },
                sms: {
                    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
                    authToken: process.env.TWILIO_AUTH_TOKEN || '',
                    phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
                }
            },
            automation: {
                enabled: process.env.AUTO_RELEASE_ENABLED === 'true',
                minimumConfidence: parseFloat(process.env.AUTO_RELEASE_MIN_CONFIDENCE || '0.9'),
                maxAutoReleaseAmount: parseInt(process.env.AUTO_RELEASE_MAX_AMOUNT || '50000'),
                delayBeforeRelease: parseInt(process.env.AUTO_RELEASE_DELAY_SECONDS || '30')
            },
            trading: {
                maxOrderAmount: parseInt(process.env.MAX_TRADE_AMOUNT || '10000'),
                defaultPaymentMethod: 'UPI',
                autoCreateOrders: false,
                profitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '100')
            }
        };

        // Initialize the orchestrator
        const orchestrator = new P2PWorkflowOrchestrator(workflowConfig);

        // Set up event listeners
        setupEventListeners(orchestrator);

        // Start the automation system
        await orchestrator.start();

        // Start API server for dashboard integration
        const apiServer = startP2PApiServer(orchestrator, 3001);

        logger.info('✅ P2P Automation System started successfully!');
        logger.info('📊 Dashboard available at: P2P-AUTOMATION-DASHBOARD.html');
        logger.info('🎛️ Control Center available at: BOT-CONTROL-CENTER.html');

        // Keep the process running
        process.on('SIGINT', async () => {
            logger.info('🛑 Shutting down P2P Automation System...');
            await orchestrator.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('🛑 Shutting down P2P Automation System...');
            await orchestrator.stop();
            process.exit(0);
        });

        // Example: Create a test arbitrage opportunity
        setTimeout(async () => {
            try {
                logger.info('🎯 Creating example arbitrage opportunity...');
                
                const exampleOpportunity = {
                    buyExchange: 'zebpay',
                    sellExchange: 'binance',
                    buyPrice: 84.20,
                    sellPrice: 86.50,
                    spread: 2.30,
                    profitPercent: 2.73,
                    amount: 100
                };

                // Uncomment to create actual order (for testing)
                // const order = await orchestrator.createArbitrageOrder(exampleOpportunity);
                // logger.info(`📝 Test order created: ${order.id}`);
                
                logger.info('💡 Example opportunity identified but not executed (auto-trading disabled)');
                logger.info(`   Buy: ${exampleOpportunity.buyExchange} @ ₹${exampleOpportunity.buyPrice}`);
                logger.info(`   Sell: ${exampleOpportunity.sellExchange} @ ₹${exampleOpportunity.sellPrice}`);
                logger.info(`   Profit: ${exampleOpportunity.profitPercent.toFixed(2)}% (₹${exampleOpportunity.spread * exampleOpportunity.amount})`);

            } catch (error) {
                logger.error('❌ Failed to create example opportunity:', error);
            }
        }, 5000);

    } catch (error) {
        logger.error('💥 Failed to initialize P2P Automation System:', error);
        process.exit(1);
    }
}

function setupEventListeners(orchestrator: P2PWorkflowOrchestrator) {
    // System events
    orchestrator.on('started', () => {
        logger.info('🟢 P2P Workflow Orchestrator started');
    });

    orchestrator.on('stopped', () => {
        logger.info('🔴 P2P Workflow Orchestrator stopped');
    });

    orchestrator.on('startError', (error) => {
        logger.error('💥 Failed to start orchestrator:', error);
    });

    orchestrator.on('stopError', (error) => {
        logger.error('💥 Failed to stop orchestrator:', error);
    });

    // Order events
    orchestrator.on('orderCreated', (order) => {
        logger.info(`📝 Order created: ${order.id} on ${order.exchange} (${order.amount} USDT @ ₹${order.price})`);
    });

    orchestrator.on('orderCompleted', (order) => {
        logger.info(`✅ Order completed: ${order.id} - Total: ₹${order.amount * order.price}`);
    });

    orchestrator.on('orderCancelled', (order) => {
        logger.warn(`❌ Order cancelled: ${order.id} - Reason: ${order.status}`);
    });

    // Payment events
    orchestrator.on('paymentDetected', (payment) => {
        logger.info(`💰 Payment detected via ${payment.source}: ₹${payment.amount} from ${payment.sender}`);
    });

    orchestrator.on('paymentReceived', (data) => {
        logger.info(`💳 Payment received for order ${data.order.id}: ₹${data.amount} (confidence: ${data.confidence})`);
    });

    orchestrator.on('paymentVerified', (verification) => {
        logger.info(`✓ Payment verified for order ${verification.orderId} (confidence: ${verification.confidence.toFixed(2)})`);
    });

    // Auto-release events
    orchestrator.on('autoReleaseScheduled', (data) => {
        logger.info(`⏰ Auto-release scheduled for order ${data.orderId} in ${data.delay} seconds`);
    });

    orchestrator.on('autoReleaseCompleted', (data) => {
        logger.info(`🚀 Auto-release completed for order ${data.orderId}`);
    });

    orchestrator.on('autoReleaseFailed', (data) => {
        logger.error(`💥 Auto-release failed for order ${data.orderId}: ${data.error}`);
    });

    // Arbitrage workflow events
    orchestrator.on('arbitrageOrderCreated', (data) => {
        logger.info(`🎯 Arbitrage order created: ${data.order.id} (${data.opportunity.profitPercent.toFixed(2)}% profit)`);
    });

    orchestrator.on('arbitrageOrderError', (data) => {
        logger.error(`💥 Arbitrage order failed: ${data.error}`);
    });

    orchestrator.on('fullWorkflowStarted', (data) => {
        logger.info(`🔄 Full arbitrage workflow started: ${data.workflowId}`);
    });

    orchestrator.on('fullWorkflowError', (data) => {
        logger.error(`💥 Full workflow failed (${data.workflowId}): ${data.error}`);
    });

    // Automation events
    orchestrator.on('automationPaused', () => {
        logger.warn('⏸️ Automation paused - manual intervention required');
    });

    orchestrator.on('automationResumed', () => {
        logger.info('▶️ Automation resumed');
    });

    // Component errors
    orchestrator.on('componentError', (data) => {
        logger.error(`💥 ${data.component} error:`, data.error);
    });

    // Configuration updates
    orchestrator.on('configUpdated', (config) => {
        logger.info('⚙️ Configuration updated:', JSON.stringify(config, null, 2));
    });
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeP2PAutomation().catch(error => {
        logger.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

export { initializeP2PAutomation };