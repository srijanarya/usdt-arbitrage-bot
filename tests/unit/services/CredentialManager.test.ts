import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CredentialManager } from '../../../src/services/security/CredentialManager';
import * as fs from 'fs';
import * as crypto from 'crypto';
import path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('CredentialManager', () => {
  let credentialManager: CredentialManager;
  const testPassword = 'test-master-password-123';
  const testEnvContent = `
BINANCE_API_KEY=test-binance-key
BINANCE_API_SECRET=test-binance-secret
ZEBPAY_API_KEY=test-zebpay-key
GMAIL_REFRESH_TOKEN=test-refresh-token
REGULAR_KEY=not-sensitive
`;

  beforeEach(() => {
    jest.clearAllMocks();
    credentialManager = new CredentialManager();
    
    // Mock file system operations
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockImplementation(((path: any, encoding?: any) => {
      if (encoding === 'utf-8' || encoding === 'utf8') {
        return testEnvContent;
      }
      return Buffer.from(testEnvContent);
    }) as any);
    mockFs.writeFileSync.mockImplementation(() => {});
  });

  describe('initialization', () => {
    it('should initialize with master password', async () => {
      await credentialManager.initialize(testPassword);
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.salt'),
        expect.any(Buffer)
      );
    });

    it('should use existing salt if available', async () => {
      const existingSalt = crypto.randomBytes(32);
      mockFs.existsSync.mockReturnValueOnce(true);
      mockFs.readFileSync.mockReturnValueOnce(existingSalt);
      
      await credentialManager.initialize(testPassword);
      
      expect(mockFs.writeFileSync).not.toHaveBeenCalledWith(
        expect.stringContaining('.salt'),
        expect.any(Buffer)
      );
    });

    it('should generate new key if no password provided', async () => {
      await credentialManager.initialize();
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('encryption', () => {
    beforeEach(async () => {
      await credentialManager.initialize(testPassword);
    });

    it('should encrypt sensitive credentials', async () => {
      await credentialManager.encryptCredentials();
      
      // Check encrypted file was written
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.credentials.enc'),
        expect.any(String)
      );
      
      // Check .env was updated with placeholders
      const envUpdateCall = mockFs.writeFileSync.mock.calls.find(
        call => call[0].toString().includes('.env')
      );
      expect(envUpdateCall).toBeDefined();
      expect(envUpdateCall![1]).toContain('ENCRYPTED');
    });

    it('should not encrypt non-sensitive keys', async () => {
      await credentialManager.encryptCredentials();
      
      const envUpdateCall = mockFs.writeFileSync.mock.calls.find(
        call => call[0].toString().includes('.env')
      );
      const updatedContent = envUpdateCall![1] as string;
      
      expect(updatedContent).toContain('REGULAR_KEY=not-sensitive');
      expect(updatedContent).not.toContain('REGULAR_KEY=ENCRYPTED');
    });

    it('should set secure file permissions', async () => {
      const mockChmod = jest.spyOn(fs, 'chmodSync').mockImplementation(() => {});
      
      await credentialManager.encryptCredentials();
      
      expect(mockChmod).toHaveBeenCalledWith(
        expect.stringContaining('.credentials.enc'),
        0o600
      );
    });
  });

  describe('decryption', () => {
    let encryptedData: any;

    beforeEach(async () => {
      await credentialManager.initialize(testPassword);
      
      // Simulate encrypted data
      encryptedData = {
        BINANCE_API_KEY: {
          iv: crypto.randomBytes(16).toString('hex'),
          encryptedData: 'mock-encrypted-data',
          authTag: crypto.randomBytes(16).toString('hex'),
          timestamp: Date.now()
        }
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(encryptedData));
    });

    it('should decrypt credentials successfully', async () => {
      // Mock the decrypt method to return original value
      jest.spyOn(credentialManager as any, 'decrypt')
        .mockReturnValue('test-binance-key');
      
      const decrypted = await credentialManager.decryptCredentials();
      
      expect(decrypted).toHaveProperty('BINANCE_API_KEY', 'test-binance-key');
    });

    it('should throw error if no encrypted credentials found', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      await expect(credentialManager.decryptCredentials())
        .rejects.toThrow('No encrypted credentials found');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new CredentialManager();
      
      await expect(uninitializedManager.decryptCredentials())
        .rejects.toThrow('Credential manager not initialized');
    });
  });

  describe('loadCredentials', () => {
    beforeEach(async () => {
      await credentialManager.initialize(testPassword);
      jest.spyOn(credentialManager, 'decryptCredentials')
        .mockResolvedValue({
          BINANCE_API_KEY: 'decrypted-key',
          BINANCE_API_SECRET: 'decrypted-secret'
        });
    });

    it('should load decrypted credentials into process.env', async () => {
      const originalEnv = { ...process.env };
      
      await credentialManager.loadCredentials();
      
      expect(process.env.BINANCE_API_KEY).toBe('decrypted-key');
      expect(process.env.BINANCE_API_SECRET).toBe('decrypted-secret');
      
      // Cleanup
      process.env = originalEnv;
    });
  });

  describe('key rotation', () => {
    beforeEach(async () => {
      await credentialManager.initialize(testPassword);
      
      // Mock successful decryption
      jest.spyOn(credentialManager, 'decryptCredentials')
        .mockResolvedValue({
          BINANCE_API_KEY: 'test-key',
          BINANCE_API_SECRET: 'test-secret'
        });
    });

    it('should rotate encryption keys', async () => {
      const newPassword = 'new-master-password-456';
      
      await credentialManager.rotateKeys(newPassword);
      
      // Should write new encrypted file
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.credentials.enc'),
        expect.any(String)
      );
    });
  });

  describe('status checking', () => {
    it('should return not encrypted status', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const status = credentialManager.getStatus();
      
      expect(status.encrypted).toBe(false);
      expect(status.lastModified).toBeUndefined();
    });

    it('should return encrypted status with details', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        mtime: new Date('2024-01-01')
      } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        KEY1: {}, KEY2: {}, KEY3: {}
      }));
      
      const status = credentialManager.getStatus();
      
      expect(status.encrypted).toBe(true);
      expect(status.lastModified).toEqual(new Date('2024-01-01'));
      expect(status.credentialCount).toBe(3);
    });
  });
});