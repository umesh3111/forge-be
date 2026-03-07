import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestMethod?: string;
  requestUrl?: string;
  requestId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

export function getRequestContext(): RequestContext {
  const store = asyncLocalStorage.getStore();
  if (!store) return {};
  
  return {
    requestMethod: store.get('requestMethod'),
    requestUrl: store.get('requestUrl'),
    requestId: store.get('requestId'),
    userId: store.get('userId'),
    traceId: store.get('traceId'),
    spanId: store.get('spanId'),
  };
}

export function setRequestContext(context: Partial<RequestContext>): void {
  const store = asyncLocalStorage.getStore();
  if (!store) return;
  
  Object.entries(context).forEach(([key, value]) => {
    if (value !== undefined) {
      store.set(key, value);
    }
  });
} 