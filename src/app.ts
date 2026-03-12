import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { swaggerOptions, swaggerUiOptions } from './plugins/swagger';
import { requestContextMiddleware } from './plugins/request-context.middleware';
import { healthRoutes } from './modules/health/health.routes';

export function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
    },
  });

  app.addHook('preHandler', requestContextMiddleware);

  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  app.register(swagger, swaggerOptions);
  app.register(swaggerUi, swaggerUiOptions);

  // Routes
  app.register(healthRoutes);

  return app;
}
