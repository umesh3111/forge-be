import { Logging as GCPCloudLogging } from '@google-cloud/logging';
import { trace } from '@opentelemetry/api';
import { getConfig } from '../../config/config.service';
import { ILogDetails } from '../framework.types';
import { asyncLocalStorage } from './async-local-storage';
import { getSafeValue, isLocalEnv, sanitizeForLogging } from '../utils';

let gcpLogClass: GCPCloudLogging | undefined;

const APP_NAME = 'olly-be';

async function logToCloud(type: 'log' | 'warn' | 'error' | 'info', logDetails: ILogDetails): Promise<void> {
  const store = asyncLocalStorage.getStore();

  const traceId = trace.getActiveSpan()?.spanContext().traceId;
  const spanId = trace.getActiveSpan()?.spanContext().spanId;

  // Only need project ID - Cloud Run provides automatic authentication
  const projectId = getConfig('GCP_PROJECT_ID') || getConfig('FIREBASE_PROJECT_ID');

  if (!projectId) {
    console.warn('⚠️ No GCP Project ID found, falling back to console logging');
    console[type](JSON.stringify(logDetails));
    return;
  }

  try {
    if (!gcpLogClass) {
      // No authentication config needed - Cloud Run provides automatic auth
      gcpLogClass = new GCPCloudLogging({ projectId });
    }

    const gcpLogger = gcpLogClass.log(APP_NAME);

    const metaData: any = {
      severity: type.toUpperCase(),
    };

    // Only add httpRequest if we have request data
    if (store?.get('requestMethod') || store?.get('requestUrl')) {
      metaData.httpRequest = {
        requestMethod: store?.get('requestMethod'),
        requestUrl: store?.get('requestUrl'),
      };
    }

    // Only add spanId if it exists
    if (spanId) {
      metaData.spanId = spanId;
    }

    // Only add stack_trace if it exists
    if (logDetails?.stackTrace) {
      metaData.stack_trace = logDetails.stackTrace;
    }

    // Only add trace if it exists
    if (traceId) {
      metaData.trace = `projects/${projectId}/traces/${traceId}`;
    }

    // Create a structured log object for the log entry
    const logObject = {
      message: logDetails.message,
      serviceName: logDetails.serviceName,
      ...logDetails.additionalInfo,
      timestamp: new Date().toISOString(),
    };

    const entry = gcpLogger.entry(metaData, logObject);
    await gcpLogger.write(entry);
  } catch (error) {
    console.error('❌ Failed to log to GCP Cloud Logging:', error);
    // Fallback to console logging
    console[type](JSON.stringify(logDetails));
  }
}

function internalLog(type: 'log' | 'warn' | 'error' | 'info', logDetails: ILogDetails): void {
  // Add emoji prefixes for better visual identification
  const emojiMap = {
    log: '📝',
    info: '📝',
    warn: '⚠️',
    error: '❌'
  };

  const enhancedLogDetails = {
    ...logDetails,
    message: `${emojiMap[type]} ${logDetails.message}`,
    additionalInfo: sanitizeForLogging(logDetails.additionalInfo)
  };

  if (isLocalEnv()) {
    // Single-line JSON for local development (like Skyline)
    console[type](JSON.stringify(enhancedLogDetails));
  } else {
    logToCloud(type, enhancedLogDetails);
  }
}

export function log(logDetails: ILogDetails): void {
  internalLog('log', logDetails);
}

export function warn(logDetails: ILogDetails): void {
  internalLog('warn', logDetails);
}

export function error(logDetails: ILogDetails): void {
  internalLog('error', logDetails);
}

export function info(logDetails: ILogDetails): void {
  internalLog('info', logDetails);
}

// Convenience functions for common logging patterns
export function logRequest(method: string, url: string, additionalInfo?: Record<string, any>): void {
  info({
    message: `🌐 ${method} ${url}`,
    serviceName: APP_NAME,
    additionalInfo: {
      requestMethod: method,
      requestUrl: url,
      ...additionalInfo
    }
  });
}

export function logError(message: string, error: Error, additionalInfo?: Record<string, any>): void {
  internalLog('error', {
    message,
    serviceName: APP_NAME,
    stackTrace: error.stack,
    additionalInfo: {
      errorName: error.name,
      errorMessage: error.message,
      ...additionalInfo
    }
  });
}

export function logAuth(message: string, userId?: string, additionalInfo?: Record<string, any>): void {
  info({
    message: `🔐 ${message}`,
    serviceName: APP_NAME,
    userId,
    additionalInfo
  });
}

export function logDatabase(message: string, additionalInfo?: Record<string, any>): void {
  info({
    message: `🗄️ ${message}`,
    serviceName: APP_NAME,
    additionalInfo
  });
}

export function logFirebase(message: string, additionalInfo?: Record<string, any>): void {
  info({
    message: `🔥 ${message}`,
    serviceName: APP_NAME,
    additionalInfo
  });
} 