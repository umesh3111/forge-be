import { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '../types/fastify';
import { asyncLocalStorage, setRequestContext } from '../framework/logging/async-local-storage';
import { generateRequestId } from '../framework/utils';
import { logRequest } from '../framework/logging/logger';

type RequestWithUser = FastifyRequest & { user?: AuthenticatedUser };

export async function requestContextMiddleware(
  request: RequestWithUser,
  reply: FastifyReply
): Promise<void> {
  const requestId = generateRequestId();
  const requestMethod = request.method;
  const requestUrl = request.url;

  // Create a new context store for this request
  const store = new Map<string, any>();
  store.set('requestMethod', requestMethod);
  store.set('requestUrl', requestUrl);
  store.set('requestId', requestId);

  // If user is authenticated, add user ID to context
  if (request.user?.userId) {
    store.set('userId', request.user.userId);
  }

  // Run the rest of the request in this context
  return new Promise((resolve, reject) => {
    asyncLocalStorage.run(store, () => {
      // Log the incoming request
      logRequest(requestMethod, requestUrl, {
        requestId,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        userId: request.user?.userId,
      });

      // Add request ID to response headers for tracing
      reply.header('x-request-id', requestId);

      resolve();
    });
  });
} 