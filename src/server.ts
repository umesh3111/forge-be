import { config } from 'dotenv';
import { buildApp } from './app';
import { getConfig } from './config/config.service';
import { database } from './database';
import { info, logError, logDatabase } from './framework/logging/logger';

config();

async function start() {
  const app = buildApp();
  
  try {
    // Connect to MongoDB
    logDatabase('Connecting to MongoDB...');
    await database.connect();
    logDatabase('MongoDB connected successfully');
    
    const port = getConfig('PORT') || 8080;
    const nodeEnv = getConfig('NODE_ENV') || 'development';

    await app.listen({ port: Number(port), host: '0.0.0.0' });
    
    info({
      message: `🚀 Server running in ${nodeEnv} mode`,
      serviceName: 'server',
      additionalInfo: { port, nodeEnv }
    });
    
    info({
      message: `📡 Server listening on http://localhost:${port}`,
      serviceName: 'server',
      additionalInfo: { port, host: 'localhost' }
    });
    
    info({
      message: `📚 API Documentation available at http://localhost:${port}/docs`,
      serviceName: 'server',
      additionalInfo: { docsUrl: `http://localhost:${port}/docs` }
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      info({
        message: '🛑 Shutting down gracefully...',
        serviceName: 'server'
      });
      await database.disconnect();
      logDatabase('MongoDB disconnected');
      await app.close();
      info({
        message: '👋 Server closed',
        serviceName: 'server'
      });
      process.exit(0);
    });
    
  } catch (err) {
    logError('Error starting server', err as Error, {
      serviceName: 'server'
    });
    process.exit(1);
  }
}

start(); 