import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { swaggerOptions, swaggerUiOptions } from './plugins/swagger';
import { initializeFirebase } from './config/firebase.service';
import { requestContextMiddleware } from './plugins/request-context.middleware';
import { logFirebase, logError } from './framework/logging/logger';

export function buildApp() {
  const app = Fastify({
    logger: false, // Disable Fastify's logger, use our custom logger
  });

  // Add request context middleware first
  app.addHook('preHandler', requestContextMiddleware);

  // Initialize Firebase
  try {
    initializeFirebase();
    logFirebase('Firebase initialized successfully');
  } catch (error) {
    logError('Failed to initialize Firebase', error as Error, {
      serviceName: 'app'
    });
  }

  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
  });

  // Register multipart for file uploads
  app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit
      files: 1 // Only allow 1 file per request
    }
  });

  app.register(swagger, swaggerOptions);
  app.register(swaggerUi, swaggerUiOptions);

  return app;
} 