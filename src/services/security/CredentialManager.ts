import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';

interface EncryptedCredential {
  iv: string;
  encryptedData: string;
  authTag: string;
  timestamp: number;
}

interface Credentials {
  [key: string]: string;
}

export class CredentialManager {
  private algorithm = 'aes-256-gcm';
  private keyDerivationIterations = 100000;
  private saltLength = 32;
  private credentialsPath: string;
  private encryptedCredsPath: string;
  private masterKey: Buffer | null = null;

  constructor() {
    this.credentialsPath = path.join(process.cwd(), '.env');
    this.encryptedCredsPath = path.join(process.cwd(), '.credentials.enc');
  }

  /**
   * Initialize the credential manager with a master password
   */
  async initialize(masterPassword?: string): Promise<void> {
    try {
      // If master password provided, derive key
      if (masterPassword) {
        this.masterKey = await this.deriveKey(masterPassword);
        logger.info('Credential manager initialized with master password');
      } else {
        // Try to use environment variable or hardware key
        const envKey = process.env.MASTER_KEY;
        if (envKey) {
          this.masterKey = Buffer.from(envKey, 'hex');
          logger.info('Credential manager initialized with environment key');
        } else {
          // Generate a new key if none exists
          this.masterKey = crypto.randomBytes(32);
          logger.warn('Generated new master key - save this securely!');
          logger.info(`Master Key (hex): ${this.masterKey.toString('hex')}`);
        }
      }

      // Check if encrypted credentials exist
      if (fs.existsSync(this.encryptedCredsPath)) {
        logger.info('Found existing encrypted credentials');
      }
    } catch (error) {
      logger.error('Failed to initialize credential manager:', error);
      throw error;
    }
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  private async deriveKey(password: string): Promise<Buffer> {
    const salt = this.getSalt();
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, this.keyDerivationIterations, 32, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  /**
   * Get or create salt for key derivation
   */
  private getSalt(): Buffer {
    const saltPath = path.join(process.cwd(), '.salt');
    if (fs.existsSync(saltPath)) {
      return fs.readFileSync(saltPath);
    } else {
      const salt = crypto.randomBytes(this.saltLength);
      fs.writeFileSync(saltPath, salt);
      return salt;
    }
  }

  /**
   * Encrypt sensitive credentials
   */
  async encryptCredentials(): Promise<void> {
    if (!this.masterKey) {
      throw new Error('Credential manager not initialized');
    }

    try {
      // Read current .env file
      const envContent = fs.readFileSync(this.credentialsPath, 'utf-8');
      const credentials = this.parseEnvFile(envContent);

      // Identify sensitive keys
      const sensitiveKeys = [
        'BINANCE_API_KEY',
        'BINANCE_API_SECRET',
        'ZEBPAY_API_KEY',
        'ZEBPAY_API_SECRET',
        'COINDCX_API_KEY',
        'COINDCX_API_SECRET',
        'GMAIL_CLIENT_SECRET',
        'GMAIL_REFRESH_TOKEN',
        'TELEGRAM_BOT_TOKEN'
      ];

      const encryptedCreds: { [key: string]: EncryptedCredential } = {};

      // Encrypt each sensitive credential
      for (const key of sensitiveKeys) {
        if (credentials[key] && credentials[key].trim() !== '') {
          const encrypted = this.encrypt(credentials[key]);
          encryptedCreds[key] = encrypted;
          
          // Replace in .env with placeholder
          credentials[key] = 'ENCRYPTED';
        }
      }

      // Save encrypted credentials
      fs.writeFileSync(
        this.encryptedCredsPath,
        JSON.stringify(encryptedCreds, null, 2)
      );

      // Update .env file with placeholders
      this.updateEnvFile(credentials);

      logger.info('✅ Credentials encrypted successfully');
      logger.info(`Encrypted credentials saved to: ${this.encryptedCredsPath}`);
      
      // Set secure permissions
      fs.chmodSync(this.encryptedCredsPath, 0o600);
      
    } catch (error) {
      logger.error('Failed to encrypt credentials:', error);
      throw error;
    }
  }

  /**
   * Decrypt credentials for use
   */
  async decryptCredentials(): Promise<Credentials> {
    if (!this.masterKey) {
      throw new Error('Credential manager not initialized');
    }

    try {
      if (!fs.existsSync(this.encryptedCredsPath)) {
        throw new Error('No encrypted credentials found');
      }

      const encryptedData = JSON.parse(
        fs.readFileSync(this.encryptedCredsPath, 'utf-8')
      );

      const decryptedCreds: Credentials = {};

      for (const [key, value] of Object.entries(encryptedData)) {
        const encCred = value as EncryptedCredential;
        decryptedCreds[key] = this.decrypt(encCred);
      }

      logger.info('✅ Credentials decrypted successfully');
      return decryptedCreds;
      
    } catch (error) {
      logger.error('Failed to decrypt credentials:', error);
      throw error;
    }
  }

  /**
   * Load credentials into process.env
   */
  async loadCredentials(): Promise<void> {
    try {
      const decrypted = await this.decryptCredentials();
      
      // Load into process.env
      for (const [key, value] of Object.entries(decrypted)) {
        process.env[key] = value;
      }

      logger.info('✅ Credentials loaded into environment');
      
    } catch (error) {
      logger.error('Failed to load credentials:', error);
      throw error;
    }
  }

  /**
   * Encrypt a single value
   */
  private encrypt(text: string): EncryptedCredential {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey!, iv) as any;
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      authTag: authTag.toString('hex'),
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt a single value
   */
  private decrypt(encryptedCredential: EncryptedCredential): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.masterKey!,
      Buffer.from(encryptedCredential.iv, 'hex')
    ) as any;
    
    decipher.setAuthTag(Buffer.from(encryptedCredential.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedCredential.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Parse .env file content
   */
  private parseEnvFile(content: string): Credentials {
    const credentials: Credentials = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          credentials[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    
    return credentials;
  }

  /**
   * Update .env file with new values
   */
  private updateEnvFile(credentials: Credentials): void {
    const lines: string[] = [];
    
    // Read existing file to preserve comments and structure
    const existingContent = fs.readFileSync(this.credentialsPath, 'utf-8');
    const existingLines = existingContent.split('\n');
    
    for (const line of existingLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') {
        lines.push(line);
      } else {
        const [key] = trimmed.split('=');
        if (key && credentials[key.trim()] !== undefined) {
          lines.push(`${key.trim()}=${credentials[key.trim()]}`);
        } else {
          lines.push(line);
        }
      }
    }
    
    fs.writeFileSync(this.credentialsPath, lines.join('\n'));
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(newMasterPassword: string): Promise<void> {
    try {
      // Decrypt with current key
      const credentials = await this.decryptCredentials();
      
      // Generate new key
      this.masterKey = await this.deriveKey(newMasterPassword);
      
      // Re-encrypt with new key
      const encryptedCreds: { [key: string]: EncryptedCredential } = {};
      
      for (const [key, value] of Object.entries(credentials)) {
        encryptedCreds[key] = this.encrypt(value);
      }
      
      // Save with new encryption
      fs.writeFileSync(
        this.encryptedCredsPath,
        JSON.stringify(encryptedCreds, null, 2)
      );
      
      logger.info('✅ Encryption keys rotated successfully');
      
    } catch (error) {
      logger.error('Failed to rotate keys:', error);
      throw error;
    }
  }

  /**
   * Check if credentials are encrypted
   */
  isEncrypted(): boolean {
    return fs.existsSync(this.encryptedCredsPath);
  }

  /**
   * Get credential status
   */
  getStatus(): { encrypted: boolean; lastModified?: Date; credentialCount?: number } {
    if (!this.isEncrypted()) {
      return { encrypted: false };
    }

    const stats = fs.statSync(this.encryptedCredsPath);
    const encryptedData = JSON.parse(
      fs.readFileSync(this.encryptedCredsPath, 'utf-8')
    );
    
    return {
      encrypted: true,
      lastModified: stats.mtime,
      credentialCount: Object.keys(encryptedData).length
    };
  }
}

// Export singleton instance
export const credentialManager = new CredentialManager();