import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { apiSecurityMonitor } from '../services/security/apiMonitor.js';

interface SecureRequest extends Request {
  apiCaller?: {
    exchange: string;
    timestamp: Date;
    signature: string;
  };
}

// IP Whitelist middleware
export function ipWhitelist(allowedIPs: string[]) {
  const ipSet = new Set(allowedIPs);
  
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.socket.remoteAddress || '';
    
    // Allow localhost always
    if (clientIP === '::1' || clientIP === '127.0.0.1' || clientIP.includes('localhost')) {
      return next();
    }
    
    if (!ipSet.has(clientIP)) {
      logger.warn(`Blocked request from unauthorized IP: ${clientIP}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  };
}

// API Request signature verification
export function verifyAPISignature(secret: string) {
  return (req: SecureRequest, res: Response, next: NextFunction) => {
    const timestamp = req.headers['x-timestamp'] as string;
    const signature = req.headers['x-signature'] as string;
    const exchange = req.headers['x-exchange'] as string;
    
    if (!timestamp || !signature) {
      return res.status(401).json({ error: 'Missing authentication headers' });
    }
    
    // Check timestamp is within 5 minutes
    const requestTime = parseInt(timestamp);
    const now = Date.now();
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Request timestamp expired' });
    }
    
    // Verify signature
    const payload = `${req.method}${req.path}${timestamp}${JSON.stringify(req.body || {})}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      logger.warn('Invalid API signature attempt', { exchange, ip: req.ip });
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    req.apiCaller = {
      exchange: exchange || 'unknown',
      timestamp: new Date(requestTime),
      signature
    };
    
    next();
  };
}

// Rate limiting per API key
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function apiRateLimit(maxRequests: number = 100, windowMinutes: number = 1) {
  return (req: SecureRequest, res: Response, next: NextFunction) => {
    const key = req.apiCaller?.signature || req.ip || 'unknown';
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    
    let limit = rateLimitMap.get(key);
    
    if (!limit || now > limit.resetTime) {
      limit = {
        count: 0,
        resetTime: now + windowMs
      };
      rateLimitMap.set(key, limit);
    }
    
    limit.count++;
    
    if (limit.count > maxRequests) {
      const retryAfter = Math.ceil((limit.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter 
      });
    }
    
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - limit.count);
    res.setHeader('X-RateLimit-Reset', new Date(limit.resetTime).toISOString());
    
    next();
  };
}

// Audit all API usage
export function auditAPIUsage(req: SecureRequest, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Log request
  const requestLog = {
    timestamp: new Date(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    exchange: req.apiCaller?.exchange,
    userAgent: req.headers['user-agent']
  };
  
  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    const duration = Date.now() - startTime;
    
    logger.info('API Request', {
      ...requestLog,
      statusCode: res.statusCode,
      duration,
      responseSize: JSON.stringify(data).length
    });
    
    return originalJson(data);
  };
  
  next();
}

// Security headers
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}