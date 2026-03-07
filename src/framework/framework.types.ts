export interface ILogDetails {
  message: string;
  serviceName?: string;
  additionalInfo?: Record<string, any>;
  stackTrace?: string;
  userId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
}

export interface IRequestContext {
  requestMethod?: string;
  requestUrl?: string;
  requestId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
} 