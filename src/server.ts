import { config } from 'dotenv';
config();

import { buildApp } from './app';
import { validateConfig, getConfig } from './config/config.service';

async function start() {
  // Validate all env vars before doing anything else — fail fast
  validateConfig();

  const app = buildApp();
  const port = Number(getConfig('PORT') ?? 3000);
  const nodeEnv = getConfig('NODE_ENV') ?? 'development';

  try {
    await app.listen({ port, host: '0.0.0.0' });

    app.log.info(`Server running in ${nodeEnv} mode on port ${port}`);
    app.log.info(`API docs: http://localhost:${port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async () => {
    app.log.info('Shutting down gracefully...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();
