import { EventEmitter } from 'events';
import { PaymentDetails } from './parsers/bankParsers';
import { P2POrder } from '../p2p/orderManager';
import { logger } from '../../utils/logger';

interface VerificationResult {
  orderId: string;
  payment: PaymentDetails;
  confidence: number;
  matches: VerificationMatch[];
  verified: boolean;
  reason?: string;
}

interface VerificationMatch {
  field: string;
  expected: any;
  actual: any;
  score: number;
  weight: number;
}

interface VerificationConfig {
  amountTolerance: number; // percentage tolerance for amount matching
  timeWindowMinutes: number; // time window to search for payments
  minimumConfidence: number; // minimum confidence for auto-approval
  enableFuzzyMatching: boolean; // enable fuzzy name matching
  requireExactAmount: boolean; // require exact amount match
}

export class PaymentVerifier extends EventEmitter {
  private pendingVerifications: Map<string, P2POrder> = new Map();
  private verificationHistory: Map<string, VerificationResult> = new Map();
  private config: VerificationConfig;

  constructor(config: Partial<VerificationConfig> = {}) {
    super();
    this.config = {
      amountTolerance: 0.01, // 1% tolerance
      timeWindowMinutes: 30,
      minimumConfidence: 0.8,
      enableFuzzyMatching: true,
      requireExactAmount: false,
      ...config
    };
  }

  async addOrderForVerification(order: P2POrder) {
    this.pendingVerifications.set(order.id, order);
    logger.info(`Added order ${order.id} for payment verification`);
  }

  async verifyPayment(payment: PaymentDetails): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    
    for (const [orderId, order] of this.pendingVerifications) {
      const result = await this.matchPaymentToOrder(payment, order);
      
      if (result.confidence > 0.1) { // Only include if there's some match
        results.push(result);
        
        // Store in history
        this.verificationHistory.set(`${orderId}_${payment.timestamp.getTime()}`, result);
        
        if (result.verified) {
          logger.info(`Payment verified for order ${orderId} with confidence ${result.confidence}`);
          this.emit('paymentVerified', result);
          this.pendingVerifications.delete(orderId);
        }
      }
    }
    
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private async matchPaymentToOrder(payment: PaymentDetails, order: P2POrder): Promise<VerificationResult> {
    const matches: VerificationMatch[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    // 1. Amount matching (highest weight)
    const amountMatch = this.calculateAmountMatch(payment.amount, order.expectedAmount || 0);
    matches.push(amountMatch);
    totalScore += amountMatch.score * amountMatch.weight;
    totalWeight += amountMatch.weight;

    // 2. Timing matching
    const timeMatch = this.calculateTimeMatch(payment.timestamp, order.createdAt);
    matches.push(timeMatch);
    totalScore += timeMatch.score * timeMatch.weight;
    totalWeight += timeMatch.weight;

    // 3. Bank account matching (if available)
    if (order.paymentDetails?.accountNumber && payment.accountNumber) {
      const accountMatch = this.calculateAccountMatch(
        payment.accountNumber,
        order.paymentDetails.accountNumber
      );
      matches.push(accountMatch);
      totalScore += accountMatch.score * accountMatch.weight;
      totalWeight += accountMatch.weight;
    }

    // 4. Sender name matching (if available)
    if (order.buyerNickname && payment.sender) {
      const nameMatch = this.calculateNameMatch(payment.sender, order.buyerNickname);
      matches.push(nameMatch);
      totalScore += nameMatch.score * nameMatch.weight;
      totalWeight += nameMatch.weight;
    }

    // 5. Bank matching
    if (order.paymentDetails?.bankName && payment.bank) {
      const bankMatch = this.calculateBankMatch(payment.bank, order.paymentDetails.bankName);
      matches.push(bankMatch);
      totalScore += bankMatch.score * bankMatch.weight;
      totalWeight += bankMatch.weight;
    }

    const confidence = totalWeight > 0 ? totalScore / totalWeight : 0;
    const verified = confidence >= this.config.minimumConfidence;

    let reason: string | undefined;
    if (!verified) {
      const failedMatches = matches.filter(m => m.score < 0.5);
      reason = `Low confidence: ${failedMatches.map(m => m.field).join(', ')} did not match well`;
    }

    return {
      orderId: order.id,
      payment,
      confidence,
      matches,
      verified,
      reason
    };
  }

  private calculateAmountMatch(receivedAmount: number, expectedAmount: number): VerificationMatch {
    const tolerance = this.config.requireExactAmount ? 0 : this.config.amountTolerance;
    const difference = Math.abs(receivedAmount - expectedAmount);
    const allowedDifference = expectedAmount * tolerance;
    
    let score = 0;
    if (difference === 0) {
      score = 1.0; // Perfect match
    } else if (difference <= allowedDifference) {
      score = 1.0 - (difference / allowedDifference) * 0.2; // Small penalty
    } else {
      score = Math.max(0, 1.0 - (difference / expectedAmount)); // Proportional penalty
    }

    return {
      field: 'amount',
      expected: expectedAmount,
      actual: receivedAmount,
      score: Math.max(0, Math.min(1, score)),
      weight: 0.4 // 40% weight
    };
  }

  private calculateTimeMatch(paymentTime: Date, orderTime: Date): VerificationMatch {
    const timeDifferenceMinutes = Math.abs(paymentTime.getTime() - orderTime.getTime()) / (1000 * 60);
    const windowMinutes = this.config.timeWindowMinutes;
    
    let score = 0;
    if (timeDifferenceMinutes <= windowMinutes) {
      score = 1.0 - (timeDifferenceMinutes / windowMinutes) * 0.5;
    } else {
      score = Math.max(0, 1.0 - (timeDifferenceMinutes / (windowMinutes * 4)));
    }

    return {
      field: 'timing',
      expected: orderTime,
      actual: paymentTime,
      score: Math.max(0, Math.min(1, score)),
      weight: 0.2 // 20% weight
    };
  }

  private calculateAccountMatch(receivedAccount: string, expectedAccount: string): VerificationMatch {
    // Extract last 4 digits for comparison (banks often mask account numbers)
    const receivedLast4 = receivedAccount.slice(-4);
    const expectedLast4 = expectedAccount.slice(-4);
    
    const score = receivedLast4 === expectedLast4 ? 1.0 : 0.0;

    return {
      field: 'accountNumber',
      expected: expectedAccount,
      actual: receivedAccount,
      score,
      weight: 0.25 // 25% weight
    };
  }

  private calculateNameMatch(receivedName: string, expectedName: string): VerificationMatch {
    if (!this.config.enableFuzzyMatching) {
      const score = receivedName.toLowerCase() === expectedName.toLowerCase() ? 1.0 : 0.0;
      return {
        field: 'senderName',
        expected: expectedName,
        actual: receivedName,
        score,
        weight: 0.1 // 10% weight
      };
    }

    // Fuzzy matching logic
    const score = this.calculateFuzzyNameScore(receivedName, expectedName);

    return {
      field: 'senderName',
      expected: expectedName,
      actual: receivedName,
      score,
      weight: 0.1 // 10% weight
    };
  }

  private calculateBankMatch(receivedBank: string, expectedBank: string): VerificationMatch {
    // Normalize bank names
    const normalize = (bank: string) => bank.toLowerCase().replace(/\s+/g, '');
    const score = normalize(receivedBank) === normalize(expectedBank) ? 1.0 : 0.5;

    return {
      field: 'bank',
      expected: expectedBank,
      actual: receivedBank,
      score,
      weight: 0.05 // 5% weight
    };
  }

  private calculateFuzzyNameScore(name1: string, name2: string): number {
    // Simple fuzzy matching using Levenshtein distance
    const distance = this.levenshteinDistance(
      name1.toLowerCase().trim(),
      name2.toLowerCase().trim()
    );
    
    const maxLength = Math.max(name1.length, name2.length);
    if (maxLength === 0) return 1.0;
    
    const similarity = 1.0 - (distance / maxLength);
    return Math.max(0, similarity);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  async getVerificationHistory(orderId?: string): Promise<VerificationResult[]> {
    if (orderId) {
      const results = Array.from(this.verificationHistory.values())
        .filter(result => result.orderId === orderId);
      return results;
    }
    return Array.from(this.verificationHistory.values());
  }

  async removeOrderFromVerification(orderId: string) {
    this.pendingVerifications.delete(orderId);
    logger.info(`Removed order ${orderId} from verification queue`);
  }

  getPendingVerifications(): P2POrder[] {
    return Array.from(this.pendingVerifications.values());
  }

  updateConfig(newConfig: Partial<VerificationConfig>) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Payment verification config updated:', this.config);
  }

  getConfig(): VerificationConfig {
    return { ...this.config };
  }

  // Manual verification method for edge cases
  async manuallyVerifyPayment(orderId: string, payment: PaymentDetails, confidence: number = 1.0): Promise<VerificationResult> {
    const order = this.pendingVerifications.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found in pending verifications`);
    }

    const result: VerificationResult = {
      orderId,
      payment,
      confidence,
      matches: [{
        field: 'manual_verification',
        expected: 'manual_approval',
        actual: 'manual_approval',
        score: 1.0,
        weight: 1.0
      }],
      verified: true,
      reason: 'Manual verification'
    };

    this.verificationHistory.set(`${orderId}_manual_${Date.now()}`, result);
    this.emit('paymentVerified', result);
    this.pendingVerifications.delete(orderId);

    logger.info(`Manual verification completed for order ${orderId}`);
    return result;
  }
}

export type { VerificationResult, VerificationMatch, VerificationConfig };