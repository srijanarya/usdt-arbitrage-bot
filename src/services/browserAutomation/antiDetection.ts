import { Page, BrowserContext } from 'playwright';
import { logger } from '../../utils/logger';

interface MouseMovement {
    x: number;
    y: number;
    duration: number;
}

export class AntiDetectionService {
    private readonly userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];

    private readonly viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1536, height: 864 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 }
    ];

    /**
     * Apply comprehensive anti-detection measures to browser context
     */
    async applyEvasionTechniques(context: BrowserContext): Promise<void> {
        // Randomize user agent
        const userAgent = this.getRandomUserAgent();
        
        // Randomize viewport
        const viewport = this.getRandomViewport();

        await context.addInitScript(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Mock plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    return [
                        {
                            0: {
                                type: 'application/x-google-chrome-pdf',
                                suffixes: 'pdf',
                                description: 'Portable Document Format'
                            },
                            description: 'Portable Document Format',
                            filename: 'internal-pdf-viewer',
                            length: 1,
                            name: 'Chrome PDF Plugin'
                        },
                        {
                            0: {
                                type: 'application/pdf',
                                suffixes: 'pdf',
                                description: ''
                            },
                            description: '',
                            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                            length: 1,
                            name: 'Chrome PDF Viewer'
                        }
                    ];
                }
            });

            // Mock permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters: any) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: 'prompt' } as PermissionStatus) :
                    originalQuery(parameters)
            );

            // Mock WebGL vendor
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter.apply(this, [parameter]);
            };

            // Mock screen properties
            Object.defineProperty(screen, 'availWidth', {
                get: () => screen.width
            });
            Object.defineProperty(screen, 'availHeight', {
                get: () => screen.height - 40
            });

            // Mock battery API
            Object.defineProperty(navigator, 'getBattery', {
                get: () => undefined
            });

            // Mock media devices
            if (!navigator.mediaDevices) {
                (navigator as any).mediaDevices = {};
            }
            navigator.mediaDevices.enumerateDevices = async () => [
                {
                    deviceId: 'default',
                    kind: 'audioinput',
                    label: 'Default Audio Device',
                    groupId: 'default'
                } as MediaDeviceInfo
            ];

            // Override chrome runtime
            if (!window.chrome) {
                (window as any).chrome = {};
            }
            if (!window.chrome.runtime) {
                window.chrome.runtime = {} as any;
            }

            // Mock languages properly
            Object.defineProperty(navigator, 'language', {
                get: () => 'en-US'
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // Hide automation indicators
            window.navigator.webdriver = false;
            (window as any).domAutomation = undefined;
            (window as any).domAutomationController = undefined;
        });

        logger.info(`🛡️ Applied anti-detection measures with UA: ${userAgent.substring(0, 50)}...`);
    }

    /**
     * Simulate human-like mouse movements
     */
    async simulateHumanMouse(page: Page, targetX: number, targetY: number): Promise<void> {
        const steps = this.generateMousePath(
            await page.mouse.position(),
            { x: targetX, y: targetY }
        );

        for (const step of steps) {
            await page.mouse.move(step.x, step.y);
            await this.randomDelay(step.duration);
        }
    }

    /**
     * Generate natural mouse movement path
     */
    private generateMousePath(
        start: { x: number; y: number },
        end: { x: number; y: number }
    ): MouseMovement[] {
        const steps: MouseMovement[] = [];
        const distance = Math.sqrt(
            Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
        );
        const stepCount = Math.max(10, Math.floor(distance / 50));

        for (let i = 0; i <= stepCount; i++) {
            const progress = i / stepCount;
            // Add slight curve to movement
            const curve = Math.sin(progress * Math.PI) * 20;
            
            steps.push({
                x: start.x + (end.x - start.x) * progress + curve,
                y: start.y + (end.y - start.y) * progress,
                duration: 10 + Math.random() * 20
            });
        }

        return steps;
    }

    /**
     * Simulate human-like typing
     */
    async simulateHumanTyping(page: Page, selector: string, text: string): Promise<void> {
        await page.click(selector);
        
        for (const char of text) {
            await page.keyboard.type(char);
            // Variable typing speed (50-150ms between keystrokes)
            await this.randomDelay(50, 150);
            
            // Occasionally pause longer (thinking)
            if (Math.random() < 0.1) {
                await this.randomDelay(300, 800);
            }
        }
    }

    /**
     * Simulate random scrolling behavior
     */
    async simulateScrolling(page: Page): Promise<void> {
        const scrolls = 2 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < scrolls; i++) {
            const direction = Math.random() > 0.5 ? 1 : -1;
            const distance = 100 + Math.random() * 200;
            
            await page.evaluate((d) => {
                window.scrollBy({
                    top: d,
                    behavior: 'smooth'
                });
            }, direction * distance);
            
            await this.randomDelay(500, 2000);
        }
    }

    /**
     * Random delay with human-like distribution
     */
    private async randomDelay(min: number, max?: number): Promise<void> {
        const maxDelay = max || min * 1.5;
        // Use log-normal distribution for more realistic delays
        const delay = min + Math.random() * (maxDelay - min);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Get random user agent
     */
    private getRandomUserAgent(): string {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    /**
     * Get random viewport
     */
    private getRandomViewport(): { width: number; height: number } {
        return this.viewports[Math.floor(Math.random() * this.viewports.length)];
    }

    /**
     * Rotate proxy for the page
     */
    async rotateProxy(page: Page, proxyUrl: string): Promise<void> {
        // Note: Proxy rotation requires browser restart or context recreation
        // This is a placeholder for proxy rotation logic
        logger.info(`🔄 Rotating proxy to: ${proxyUrl}`);
    }

    /**
     * Check if page is detected as bot
     */
    async checkDetection(page: Page): Promise<boolean> {
        try {
            // Check for common bot detection elements
            const botDetectionSelectors = [
                'div[class*="captcha"]',
                'div[class*="robot"]',
                'div[class*="bot-detection"]',
                '#px-captcha',
                '.g-recaptcha',
                'div[class*="cloudflare"]'
            ];

            for (const selector of botDetectionSelectors) {
                const element = await page.$(selector);
                if (element) {
                    logger.warn(`⚠️ Bot detection element found: ${selector}`);
                    return true;
                }
            }

            // Check for rate limiting messages
            const pageContent = await page.content();
            const rateLimitPatterns = [
                /rate limit/i,
                /too many requests/i,
                /please slow down/i,
                /suspicious activity/i
            ];

            for (const pattern of rateLimitPatterns) {
                if (pattern.test(pageContent)) {
                    logger.warn(`⚠️ Rate limiting detected`);
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error('Error checking detection:', error);
            return false;
        }
    }

    /**
     * Handle CAPTCHA if detected
     */
    async handleCaptcha(page: Page): Promise<boolean> {
        logger.warn('🤖 CAPTCHA detected - manual intervention may be required');
        
        // Options:
        // 1. Wait for manual solving
        // 2. Use CAPTCHA solving service (2captcha, anti-captcha)
        // 3. Retry with different approach
        
        // For now, wait for manual intervention
        await page.waitForNavigation({
            timeout: 300000, // 5 minutes
            waitUntil: 'networkidle'
        }).catch(() => {
            logger.error('CAPTCHA solving timeout');
            return false;
        });

        return true;
    }

    /**
     * Apply request interception for additional stealth
     */
    async applyRequestInterception(page: Page): Promise<void> {
        await page.route('**/*', async (route) => {
            const request = route.request();
            const headers = {
                ...request.headers(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            };

            // Remove automation-related headers
            delete headers['sec-ch-ua-platform'];
            
            await route.continue({ headers });
        });
    }
}

// Export singleton instance
export const antiDetection = new AntiDetectionService();