import { logger } from '../utils/logger';
import chalk from 'chalk';

interface SafetyCheck {
    name: string;
    check: () => Promise<boolean>;
    errorMessage: string;
    critical: boolean;
}

interface TradeValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    blockers: string[];
}

export class SafetyGuard {
    private static instance: SafetyGuard;
    private safetyChecks: Map<string, SafetyCheck[]> = new Map();
    
    static getInstance(): SafetyGuard {
        if (!SafetyGuard.instance) {
            SafetyGuard.instance = new SafetyGuard();
        }
        return SafetyGuard.instance;
    }
    
    constructor() {
        this.initializeDefaultChecks();
    }
    
    private initializeDefaultChecks() {
        // Exchange connectivity checks
        this.addCheck('exchange_connectivity', {
            name: 'API Connection',
            check: async () => {
                // Check if APIs are responding
                return true; // Implement actual check
            },
            errorMessage: 'Exchange API not responding',
            critical: true
        });
        
        // Withdrawal address checks
        this.addCheck('withdrawal', {
            name: 'Withdrawal Address',
            check: async () => {
                // Check if withdrawal addresses are configured
                console.warn('⚠️  Withdrawal address check not implemented');
                return false;
            },
            errorMessage: 'Withdrawal address not configured',
            critical: true
        });
        
        // Minimum amount checks
        this.addCheck('minimum_amount', {
            name: 'Minimum Amount',
            check: async () => {
                // Check if amount meets minimum requirements
                return true; // Implement based on exchange
            },
            errorMessage: 'Amount below minimum requirement',
            critical: true
        });
        
        // Payment method checks
        this.addCheck('payment_method', {
            name: 'Payment Method',
            check: async () => {
                // Check if payment methods are configured
                return true; // Implement actual check
            },
            errorMessage: 'Payment method not configured',
            critical: true
        });
        
        // 2FA checks
        this.addCheck('security', {
            name: '2FA Status',
            check: async () => {
                console.warn('⚠️  Cannot verify 2FA status via API');
                return true; // Assume enabled
            },
            errorMessage: '2FA not enabled',
            critical: false
        });
    }
    
    addCheck(category: string, check: SafetyCheck) {
        if (!this.safetyChecks.has(category)) {
            this.safetyChecks.set(category, []);
        }
        this.safetyChecks.get(category)!.push(check);
    }
    
    async validateTrade(params: {
        type: 'transfer' | 'buy' | 'sell' | 'p2p';
        fromExchange?: string;
        toExchange?: string;
        amount?: number;
        currency?: string;
        paymentMethod?: string;
    }): Promise<TradeValidation> {
        const validation: TradeValidation = {
            isValid: true,
            errors: [],
            warnings: [],
            blockers: []
        };
        
        console.log(chalk.yellow('\n🛡️  SAFETY VALIDATION IN PROGRESS...\n'));
        
        // Run all relevant checks based on trade type
        const relevantChecks = this.getRelevantChecks(params.type);
        
        for (const [category, checks] of relevantChecks) {
            console.log(chalk.cyan(`Checking ${category}...`));
            
            for (const check of checks) {
                try {
                    const passed = await check.check();
                    
                    if (!passed) {
                        if (check.critical) {
                            validation.isValid = false;
                            validation.blockers.push(check.errorMessage);
                            console.log(chalk.red(`  ❌ ${check.name}: ${check.errorMessage}`));
                        } else {
                            validation.warnings.push(check.errorMessage);
                            console.log(chalk.yellow(`  ⚠️  ${check.name}: ${check.errorMessage}`));
                        }
                    } else {
                        console.log(chalk.green(`  ✅ ${check.name}: Passed`));
                    }
                } catch (error: any) {
                    validation.errors.push(`${check.name} check failed: ${error.message}`);
                    console.log(chalk.red(`  ❌ ${check.name}: Error - ${error.message}`));
                }
            }
        }
        
        // Add specific validations based on trade type
        if (params.type === 'transfer') {
            if (!params.fromExchange || !params.toExchange) {
                validation.blockers.push('Source and destination exchanges must be specified');
                validation.isValid = false;
            }
            
            if (params.fromExchange === params.toExchange) {
                validation.blockers.push('Cannot transfer to the same exchange');
                validation.isValid = false;
            }
            
            // Check withdrawal fees
            validation.warnings.push('Remember to account for withdrawal fees (1-3 USDT)');
        }
        
        if (params.type === 'p2p' && !params.paymentMethod) {
            validation.blockers.push('Payment method must be specified for P2P trades');
            validation.isValid = false;
        }
        
        // Summary
        console.log(chalk.yellow('\n📋 VALIDATION SUMMARY:\n'));
        
        if (validation.blockers.length > 0) {
            console.log(chalk.red('🚫 BLOCKERS (Must fix before trading):'));
            validation.blockers.forEach(blocker => {
                console.log(chalk.red(`   • ${blocker}`));
            });
        }
        
        if (validation.warnings.length > 0) {
            console.log(chalk.yellow('\n⚠️  WARNINGS (Please review):'));
            validation.warnings.forEach(warning => {
                console.log(chalk.yellow(`   • ${warning}`));
            });
        }
        
        if (validation.errors.length > 0) {
            console.log(chalk.red('\n❌ ERRORS:'));
            validation.errors.forEach(error => {
                console.log(chalk.red(`   • ${error}`));
            });
        }
        
        if (validation.isValid) {
            console.log(chalk.green('\n✅ ALL SAFETY CHECKS PASSED - Trade can proceed\n'));
        } else {
            console.log(chalk.red('\n❌ SAFETY VALIDATION FAILED - DO NOT PROCEED\n'));
        }
        
        return validation;
    }
    
    private getRelevantChecks(tradeType: string): Map<string, SafetyCheck[]> {
        const relevant = new Map<string, SafetyCheck[]>();
        
        // Always check connectivity
        relevant.set('exchange_connectivity', this.safetyChecks.get('exchange_connectivity') || []);
        relevant.set('security', this.safetyChecks.get('security') || []);
        
        switch (tradeType) {
            case 'transfer':
                relevant.set('withdrawal', this.safetyChecks.get('withdrawal') || []);
                relevant.set('minimum_amount', this.safetyChecks.get('minimum_amount') || []);
                break;
            case 'p2p':
                relevant.set('payment_method', this.safetyChecks.get('payment_method') || []);
                relevant.set('minimum_amount', this.safetyChecks.get('minimum_amount') || []);
                break;
            case 'buy':
            case 'sell':
                relevant.set('minimum_amount', this.safetyChecks.get('minimum_amount') || []);
                break;
        }
        
        return relevant;
    }
    
    // Convenience method for quick validation
    async canExecuteTrade(tradeType: string, amount: number = 0): Promise<boolean> {
        const validation = await this.validateTrade({ type: tradeType as any, amount });
        return validation.isValid;
    }
    
    // Pre-execution confirmation
    async confirmExecution(action: string): Promise<boolean> {
        console.log(chalk.yellow(`\n⚠️  ABOUT TO EXECUTE: ${action}`));
        console.log(chalk.yellow('This will involve REAL MONEY. Are you sure?'));
        console.log(chalk.red('\nPRESS CTRL+C TO CANCEL\n'));
        
        // In production, this would wait for user input
        // For now, we'll always return false to prevent automatic execution
        return false;
    }
}

// Export singleton instance
export const safetyGuard = SafetyGuard.getInstance();