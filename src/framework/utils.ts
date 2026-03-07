import { getConfig } from '../config/config.service';

export function isLocalEnv(): boolean {
  const nodeEnv = getConfig('NODE_ENV') || 'development';
  return nodeEnv === 'development' || nodeEnv === 'local';
}

export function getSafeValue<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  key: K
): T[K] | (() => void) {
  if (obj && typeof obj === 'object' && key in obj) {
    return obj[key];
  }
  return () => {}; // Return a no-op function as fallback
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function sanitizeForLogging(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...obj };

  for (const key in sanitized) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
} 