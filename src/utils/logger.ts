import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logDir = 'logs';

// Create log directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Create custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create the winston logger
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'arbitrage.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for errors only
    new winston.transports.File({
      filename: path.join(logDir, 'errors.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Export logger with backward compatibility
export const logger = {
  info: (message: string, ...args: any[]) => {
    winstonLogger.info(message, ...args);
  },
  
  error: (message: string, error?: any) => {
    winstonLogger.error(message, error);
  },
  
  warn: (message: string, ...args: any[]) => {
    winstonLogger.warn(message, ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    winstonLogger.debug(message, ...args);
  }
};

// Create a stream for Morgan middleware
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};