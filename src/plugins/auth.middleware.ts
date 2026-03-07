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
    
    // Extract user information from the decoded token
    request.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
      email_verified: decodedToken.email_verified,
    };

    logAuth('User authenticated successfully', decodedToken.uid, {
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      url: request.url,
      method: request.method
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