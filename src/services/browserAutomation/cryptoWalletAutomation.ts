import { chromium, Browser, BrowserContext, Page, devices } from 'playwright';
import { logger } from '../../utils/logger';

interface ExchangeConfig {
    name: string;
    loginUrl: string;
    walletUrl: string;
    selectors: {
        username?: string;
        password?: string;
        loginButton?: string;
        balanceElement?: string;
        depositButton?: string;
        buyButton?: string;
        priceElement?: string;
    };
}

interface WalletOperation {
    type: 'deposit' | 'withdraw' | 'buy' | 'sell';
    amount: number;
    currency: string;
    targetPrice?: number;
}

export class CryptoWalletAutomation {
    private browser: Browser | null = null;
    private contexts: Map<string, BrowserContext> = new Map();
    private exchangeConfigs: Map<string, ExchangeConfig>;

    constructor() {
        // Initialize with exchange configurations
        this.exchangeConfigs = new Map([
            ['binance', {
                name: 'binance',
                loginUrl: 'https://www.binance.com/en/login',
                walletUrl: 'https://www.binance.com/en/my/wallet',
                selectors: {
                    username: 'input[name="email"]',
                    password: 'input[name="password"]',
                    loginButton: 'button[type="submit"]',
                    balanceElement: '.balance-text',
                    depositButton: 'button[data-action="deposit"]',
                    buyButton: 'button[data-action="buy"]',
                    priceElement: '.price-ticker'
                }
            }],
            ['zebpay', {
                name: 'zebpay',
                loginUrl: 'https://www.zebpay.com/in/login',
                walletUrl: 'https://www.zebpay.com/in/wallet',
                selectors: {
                    username: 'input[type="email"]',
                    password: 'input[type="password"]',
                    loginButton: 'button[type="submit"]',
                    balanceElement: '.wallet-balance',
                    depositButton: '.deposit-btn',
                    buyButton: '.buy-btn',
                    priceElement: '.market-price'
                }
            }]
        ]);
    }

    /**
     * Initialize browser with anti-detection measures
     */
    async initialize(): Promise<void> {
        try {
            logger.info('🚀 Initializing browser automation...');

            // Launch browser with stealth settings
            this.browser = await chromium.launch({
                headless: false, // Set to true for production
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote'
                ]
            });

            logger.info('✅ Browser initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize browser:', error);
            throw error;
        }
    }

    /**
     * Create isolated context for each exchange
     */
    async createExchangeContext(exchangeName: string, options?: any): Promise<BrowserContext> {
        if (!this.browser) {
            throw new Error('Browser not initialized');
        }

        // Use different device profiles to appear more natural
        const deviceProfiles = [
            devices['Desktop Chrome'],
            devices['Desktop Firefox'],
            devices['Desktop Safari']
        ];
        const randomDevice = deviceProfiles[Math.floor(Math.random() * deviceProfiles.length)];

        const context = await this.browser.newContext({
            ...randomDevice,
            locale: 'en-IN',
            timezoneId: 'Asia/Kolkata',
            permissions: ['notifications'],
            ...options
        });

        // Add anti-detection scripts
        await context.addInitScript(() => {
            // Override webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Override plugins to appear more natural
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-IN', 'en-US', 'en']
            });
        });

        this.contexts.set(exchangeName, context);
        return context;
    }

    /**
     * Login to exchange with proper error handling
     */
    async loginToExchange(
        exchangeName: string,
        credentials: { username: string; password: string }
    ): Promise<Page> {
        const config = this.exchangeConfigs.get(exchangeName);
        if (!config) {
            throw new Error(`Exchange ${exchangeName} not configured`);
        }

        let context = this.contexts.get(exchangeName);
        if (!context) {
            context = await this.createExchangeContext(exchangeName);
        }

        const page = await context.newPage();

        try {
            logger.info(`🔐 Logging into ${exchangeName}...`);

            // Navigate to login page
            await page.goto(config.loginUrl, { waitUntil: 'networkidle' });

            // Add random delays to mimic human behavior
            await this.humanDelay();

            // Fill credentials
            if (config.selectors.username) {
                await page.fill(config.selectors.username, credentials.username);
                await this.humanDelay(500, 1000);
            }

            if (config.selectors.password) {
                await page.fill(config.selectors.password, credentials.password);
                await this.humanDelay(500, 1000);
            }

            // Click login button
            if (config.selectors.loginButton) {
                await page.click(config.selectors.loginButton);
            }

            // Wait for navigation or specific element
            await page.waitForNavigation({ waitUntil: 'networkidle' });

            logger.info(`✅ Successfully logged into ${exchangeName}`);
            return page;

        } catch (error) {
            logger.error(`Failed to login to ${exchangeName}:`, error);
            await page.close();
            throw error;
        }
    }

    /**
     * Monitor price and execute buy when target is reached
     */
    async monitorAndBuy(
        exchangeName: string,
        targetPrice: number,
        amount: number,
        page?: Page
    ): Promise<void> {
        const config = this.exchangeConfigs.get(exchangeName);
        if (!config) {
            throw new Error(`Exchange ${exchangeName} not configured`);
        }

        const activePage = page || await this.getActivePage(exchangeName);
        
        try {
            logger.info(`📊 Monitoring ${exchangeName} for price ≤ ₹${targetPrice}`);

            // Poll for price
            const checkPrice = async (): Promise<boolean> => {
                if (!config.selectors.priceElement) return false;

                const priceText = await activePage.textContent(config.selectors.priceElement);
                const currentPrice = parseFloat(priceText?.replace(/[^0-9.]/g, '') || '0');

                logger.info(`Current price on ${exchangeName}: ₹${currentPrice}`);

                if (currentPrice <= targetPrice && currentPrice > 0) {
                    logger.info(`🎯 Target price reached! Executing buy order...`);
                    
                    if (config.selectors.buyButton) {
                        await activePage.click(config.selectors.buyButton);
                        // Handle buy flow (varies by exchange)
                        await this.handleBuyFlow(activePage, amount, exchangeName);
                    }
                    
                    return true;
                }

                return false;
            };

            // Check price every 30 seconds
            while (true) {
                if (await checkPrice()) {
                    break;
                }
                await this.humanDelay(30000, 35000); // 30-35 seconds
            }

        } catch (error) {
            logger.error(`Price monitoring error on ${exchangeName}:`, error);
            throw error;
        }
    }

    /**
     * Handle the buy flow (exchange-specific)
     */
    private async handleBuyFlow(page: Page, amount: number, exchangeName: string): Promise<void> {
        // This would need to be customized for each exchange
        logger.info(`Processing buy order for ${amount} USDT on ${exchangeName}`);
        
        // Example flow (would vary by exchange):
        // 1. Enter amount
        // 2. Select payment method
        // 3. Confirm order
        // 4. Handle 2FA if required
        
        await this.humanDelay(2000, 3000);
    }

    /**
     * Get wallet balance
     */
    async getWalletBalance(exchangeName: string, currency: string = 'USDT'): Promise<number> {
        const config = this.exchangeConfigs.get(exchangeName);
        if (!config) {
            throw new Error(`Exchange ${exchangeName} not configured`);
        }

        const page = await this.getActivePage(exchangeName);

        try {
            // Navigate to wallet page
            await page.goto(config.walletUrl, { waitUntil: 'networkidle' });
            await this.humanDelay();

            // Get balance
            if (config.selectors.balanceElement) {
                const balanceText = await page.textContent(config.selectors.balanceElement);
                const balance = parseFloat(balanceText?.replace(/[^0-9.]/g, '') || '0');
                
                logger.info(`💰 ${exchangeName} ${currency} balance: ${balance}`);
                return balance;
            }

            return 0;
        } catch (error) {
            logger.error(`Failed to get balance from ${exchangeName}:`, error);
            throw error;
        }
    }

    /**
     * Preload INR to exchange
     */
    async preloadINR(exchangeName: string, amount: number): Promise<void> {
        const config = this.exchangeConfigs.get(exchangeName);
        if (!config) {
            throw new Error(`Exchange ${exchangeName} not configured`);
        }

        const page = await this.getActivePage(exchangeName);

        try {
            logger.info(`💵 Preloading ₹${amount} to ${exchangeName}...`);

            // Navigate to deposit section
            if (config.selectors.depositButton) {
                await page.click(config.selectors.depositButton);
                await this.humanDelay();
            }

            // Handle deposit flow (exchange-specific)
            // This would include:
            // 1. Select INR
            // 2. Enter amount
            // 3. Select payment method (UPI/IMPS/Bank Transfer)
            // 4. Complete payment

            logger.info(`✅ INR preload initiated for ${exchangeName}`);
        } catch (error) {
            logger.error(`Failed to preload INR to ${exchangeName}:`, error);
            throw error;
        }
    }

    /**
     * Get active page for exchange or create new one
     */
    private async getActivePage(exchangeName: string): Promise<Page> {
        const context = this.contexts.get(exchangeName);
        if (!context) {
            throw new Error(`No context found for ${exchangeName}`);
        }

        const pages = context.pages();
        if (pages.length > 0) {
            return pages[0];
        }

        return await context.newPage();
    }

    /**
     * Add human-like delays
     */
    private async humanDelay(min: number = 1000, max: number = 3000): Promise<void> {
        const delay = Math.floor(Math.random() * (max - min) + min);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        logger.info('🧹 Cleaning up browser automation resources...');

        // Close all contexts
        for (const [name, context] of this.contexts) {
            try {
                await context.close();
                logger.info(`Closed context for ${name}`);
            } catch (error) {
                logger.error(`Error closing context for ${name}:`, error);
            }
        }

        // Close browser
        if (this.browser) {
            await this.browser.close();
        }

        this.contexts.clear();
        logger.info('✅ Cleanup completed');
    }

    /**
     * Save session state for reuse
     */
    async saveSession(exchangeName: string, path: string): Promise<void> {
        const context = this.contexts.get(exchangeName);
        if (!context) {
            throw new Error(`No context found for ${exchangeName}`);
        }

        await context.storageState({ path });
        logger.info(`💾 Session saved for ${exchangeName}`);
    }

    /**
     * Load saved session
     */
    async loadSession(exchangeName: string, path: string): Promise<void> {
        await this.createExchangeContext(exchangeName, { storageState: path });
        logger.info(`📂 Session loaded for ${exchangeName}`);
    }
}

// Example usage
async function exampleUsage() {
    const automation = new CryptoWalletAutomation();

    try {
        // Initialize browser
        await automation.initialize();

        // Login to exchanges (credentials should be from secure storage)
        await automation.loginToExchange('binance', {
            username: process.env.BINANCE_USERNAME!,
            password: process.env.BINANCE_PASSWORD!
        });

        // Get wallet balance
        const balance = await automation.getWalletBalance('binance', 'USDT');

        // Monitor price and auto-buy
        await automation.monitorAndBuy('binance', 84.50, 100);

        // Save session for future use
        await automation.saveSession('binance', './sessions/binance-session.json');

    } catch (error) {
        logger.error('Automation error:', error);
    } finally {
        await automation.cleanup();
    }
}

export { exampleUsage };