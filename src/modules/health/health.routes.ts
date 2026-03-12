import { Type } from '@sinclair/typebox';
import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', {
    schema: {
      description: 'Health check',
      tags: ['Health'],
      response: {
        200: Type.Object({
          status: Type.String(),
          timestamp: Type.String(),
        }),
      },
    },
  }, async (_request, _reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}
