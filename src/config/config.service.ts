import { Type, Static } from '@sinclair/typebox';

const ConfigSchema = Type.Object({
  NODE_ENV: Type.Union([
    Type.Literal('development'),
    Type.Literal('production'),
    Type.Literal('test'),
  ], { default: 'development' }),
  PORT: Type.String({ default: '3000' }),
  LOG_LEVEL: Type.Union([
    Type.Literal('trace'),
    Type.Literal('debug'),
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error'),
    Type.Literal('fatal'),
  ], { default: 'info' }),

  // PostgreSQL
  DATABASE_URL: Type.String(),

  // Redis
  REDIS_URL: Type.String(),

  // Auth
  JWT_SECRET: Type.String(),

  // AI / Memory
  ANTHROPIC_API_KEY: Type.String(),
  MEM0_API_KEY: Type.String(),

  // GCP (optional — used for Cloud Logging in production)
  GCP_PROJECT_ID: Type.Optional(Type.String()),
});

type Config = Static<typeof ConfigSchema>;

let config: Config | null = null;

export function validateConfig(): Config {
  if (config) return config;

  const env = {} as Record<string, string | undefined>;

  const requiredFields = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'ANTHROPIC_API_KEY',
    'MEM0_API_KEY',
  ];

  const fieldsWithDefaults = ['NODE_ENV', 'PORT', 'LOG_LEVEL'];

  const optionalFields = ['GCP_PROJECT_ID'];

  const missing: string[] = [];

  for (const key of requiredFields) {
    env[key] = process.env[key];
    if (!env[key]) missing.push(key);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  ${missing.join('\n  ')}`
    );
  }

  for (const key of fieldsWithDefaults) {
    const schemaProperty = ConfigSchema.properties[key as keyof typeof ConfigSchema.properties];
    env[key] = process.env[key] || ('default' in schemaProperty ? String(schemaProperty.default) : undefined);
  }

  for (const key of optionalFields) {
    env[key] = process.env[key];
  }

  config = env as Config;
  return config;
}

export function getConfig(key: keyof Config): string | undefined {
  if (!config) validateConfig();
  return config![key] as string | undefined;
}
