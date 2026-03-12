import { FastifyRequest, FastifyReply } from 'fastify';
import { getFirebaseAuth } from '../config/firebase.service';
import { logAuth, warn, logError } from '../framework/logging/logger';
import type { AuthenticatedUser } from '../types/fastify';

export type { AuthenticatedUser };

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      warn({
        message: 'Authentication failed: Missing or invalid authorization header',
        serviceName: 'auth-middleware',
        additionalInfo: { 
          url: request.url,
          method: request.method,
          hasAuthHeader: !!authHeader
        }
      });
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      warn({
        message: 'Authentication failed: Missing token',
        serviceName: 'auth-middleware',
        additionalInfo: { url: request.url, method: request.method }
      });
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing token'
      });
    }

    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(token);
    
    // Map Firebase UID to the shared userId field
    // NOTE: This middleware will be replaced by JWT auth in Task 2.1
    request.user = {
      userId: decodedToken.uid,
    };

    logAuth('User authenticated successfully', decodedToken.uid, {
      url: request.url,
      method: request.method,
    });

  } catch (error) {
    logError('Token verification failed', error as Error, {
      url: request.url,
      method: request.method,
      hasAuthHeader: !!request.headers.authorization
    });
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
} 