import { logger } from '../../utils/logger';

interface ProxyConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
    protocol: 'http' | 'https' | 'socks5';
}

interface ProxyStats {
    lastUsed: Date;
    failureCount: number;
    successCount: number;
    averageResponseTime: number;
}

export class ProxyManager {
    private proxies: Map<string, ProxyConfig> = new Map();
    private proxyStats: Map<string, ProxyStats> = new Map();
    private currentProxyIndex: number = 0;
    private blacklistedProxies: Set<string> = new Set();

    constructor(proxies: ProxyConfig[] = []) {
        this.loadProxies(proxies);
    }

    /**
     * Load proxies into the manager
     */
    private loadProxies(proxies: ProxyConfig[]): void {
        proxies.forEach((proxy, index) => {
            const proxyId = this.getProxyId(proxy);
            this.proxies.set(proxyId, proxy);
            this.proxyStats.set(proxyId, {
                lastUsed: new Date(0),
                failureCount: 0,
                successCount: 0,
                averageResponseTime: 0
            });
        });

        logger.info(`📡 Loaded ${proxies.length} proxies`);
    }

    /**
     * Get next available proxy
     */
    getNextProxy(): ProxyConfig | null {
        const availableProxies = Array.from(this.proxies.entries())
            .filter(([id, _]) => !this.blacklistedProxies.has(id))
            .sort(([idA, _a], [idB, _b]) => {
                const statsA = this.proxyStats.get(idA)!;
                const statsB = this.proxyStats.get(idB)!;
                
                // Prioritize by success rate and last used time
                const scoreA = this.calculateProxyScore(statsA);
                const scoreB = this.calculateProxyScore(statsB);
                
                return scoreB - scoreA;
            });

        if (availableProxies.length === 0) {
            logger.error('❌ No available proxies');
            return null;
        }

        const [proxyId, proxy] = availableProxies[0];
        this.proxyStats.get(proxyId)!.lastUsed = new Date();
        
        logger.info(`🔄 Selected proxy: ${this.maskProxy(proxy)}`);
        return proxy;
    }

    /**
     * Get proxy URL for Playwright
     */
    getProxyUrl(proxy: ProxyConfig): string {
        let url = `${proxy.protocol}://`;
        
        if (proxy.username && proxy.password) {
            url += `${proxy.username}:${proxy.password}@`;
        }
        
        url += `${proxy.host}:${proxy.port}`;
        return url;
    }

    /**
     * Report proxy success
     */
    reportSuccess(proxy: ProxyConfig, responseTime: number): void {
        const proxyId = this.getProxyId(proxy);
        const stats = this.proxyStats.get(proxyId);
        
        if (stats) {
            stats.successCount++;
            stats.averageResponseTime = 
                (stats.averageResponseTime * (stats.successCount - 1) + responseTime) / 
                stats.successCount;
            
            logger.info(`✅ Proxy success: ${this.maskProxy(proxy)} (${responseTime}ms)`);
        }
    }

    /**
     * Report proxy failure
     */
    reportFailure(proxy: ProxyConfig, error: any): void {
        const proxyId = this.getProxyId(proxy);
        const stats = this.proxyStats.get(proxyId);
        
        if (stats) {
            stats.failureCount++;
            
            // Blacklist proxy after 3 consecutive failures
            if (stats.failureCount >= 3) {
                this.blacklistedProxies.add(proxyId);
                logger.warn(`🚫 Blacklisted proxy: ${this.maskProxy(proxy)}`);
            }
            
            logger.error(`❌ Proxy failure: ${this.maskProxy(proxy)} - ${error.message}`);
        }
    }

    /**
     * Calculate proxy score for selection
     */
    private calculateProxyScore(stats: ProxyStats): number {
        const successRate = stats.successCount / (stats.successCount + stats.failureCount + 1);
        const timeSinceLastUse = Date.now() - stats.lastUsed.getTime();
        const responseTimeScore = stats.averageResponseTime > 0 ? 1000 / stats.averageResponseTime : 1;
        
        return successRate * 100 + (timeSinceLastUse / 1000000) + responseTimeScore;
    }

    /**
     * Get proxy identifier
     */
    private getProxyId(proxy: ProxyConfig): string {
        return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    }

    /**
     * Mask proxy credentials for logging
     */
    private maskProxy(proxy: ProxyConfig): string {
        return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    }

    /**
     * Get proxy statistics
     */
    getStatistics(): {
        total: number;
        available: number;
        blacklisted: number;
        stats: Array<{
            proxy: string;
            successRate: number;
            averageResponseTime: number;
        }>;
    } {
        const available = this.proxies.size - this.blacklistedProxies.size;
        
        const stats = Array.from(this.proxyStats.entries()).map(([proxyId, stats]) => {
            const proxy = this.proxies.get(proxyId)!;
            const total = stats.successCount + stats.failureCount;
            const successRate = total > 0 ? stats.successCount / total : 0;
            
            return {
                proxy: this.maskProxy(proxy),
                successRate: Math.round(successRate * 100),
                averageResponseTime: Math.round(stats.averageResponseTime)
            };
        });

        return {
            total: this.proxies.size,
            available,
            blacklisted: this.blacklistedProxies.size,
            stats
        };
    }

    /**
     * Reset blacklisted proxies
     */
    resetBlacklist(): void {
        this.blacklistedProxies.clear();
        
        // Reset failure counts
        this.proxyStats.forEach(stats => {
            stats.failureCount = 0;
        });
        
        logger.info('🔄 Reset proxy blacklist');
    }

    /**
     * Add new proxy at runtime
     */
    addProxy(proxy: ProxyConfig): void {
        const proxyId = this.getProxyId(proxy);
        
        if (!this.proxies.has(proxyId)) {
            this.proxies.set(proxyId, proxy);
            this.proxyStats.set(proxyId, {
                lastUsed: new Date(0),
                failureCount: 0,
                successCount: 0,
                averageResponseTime: 0
            });
            
            logger.info(`➕ Added new proxy: ${this.maskProxy(proxy)}`);
        }
    }

    /**
     * Remove proxy
     */
    removeProxy(proxy: ProxyConfig): void {
        const proxyId = this.getProxyId(proxy);
        this.proxies.delete(proxyId);
        this.proxyStats.delete(proxyId);
        this.blacklistedProxies.delete(proxyId);
        
        logger.info(`➖ Removed proxy: ${this.maskProxy(proxy)}`);
    }

    /**
     * Get proxy configuration for Playwright context
     */
    getPlaywrightProxyConfig(proxy: ProxyConfig): any {
        return {
            server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
            username: proxy.username,
            password: proxy.password
        };
    }

    /**
     * Test proxy connectivity
     */
    async testProxy(proxy: ProxyConfig): Promise<boolean> {
        try {
            const axios = require('axios');
            const startTime = Date.now();
            
            const response = await axios.get('https://api.ipify.org?format=json', {
                proxy: {
                    protocol: proxy.protocol,
                    host: proxy.host,
                    port: proxy.port,
                    auth: proxy.username && proxy.password ? {
                        username: proxy.username,
                        password: proxy.password
                    } : undefined
                },
                timeout: 10000
            });

            const responseTime = Date.now() - startTime;
            logger.info(`✅ Proxy test successful: ${this.maskProxy(proxy)} - IP: ${response.data.ip} (${responseTime}ms)`);
            
            this.reportSuccess(proxy, responseTime);
            return true;
            
        } catch (error) {
            logger.error(`❌ Proxy test failed: ${this.maskProxy(proxy)}`);
            this.reportFailure(proxy, error);
            return false;
        }
    }

    /**
     * Test all proxies
     */
    async testAllProxies(): Promise<void> {
        logger.info('🧪 Testing all proxies...');
        
        const promises = Array.from(this.proxies.values()).map(proxy => 
            this.testProxy(proxy).catch(() => false)
        );
        
        const results = await Promise.all(promises);
        const successful = results.filter(r => r).length;
        
        logger.info(`✅ Proxy test complete: ${successful}/${this.proxies.size} working`);
    }
}

// Example proxy configurations
export const defaultProxyConfigs: ProxyConfig[] = [
    // Add your proxy configurations here
    // {
    //     host: 'proxy1.example.com',
    //     port: 8080,
    //     username: 'user',
    //     password: 'pass',
    //     protocol: 'http'
    // }
];

// Export singleton instance with default proxies
export const proxyManager = new ProxyManager(defaultProxyConfigs);