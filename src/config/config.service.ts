import { Type, Static } from '@sinclair/typebox';

const ConfigSchema = Type.Object({
  NODE_ENV: Type.String({ default: 'development' }),
  PORT: Type.String({ default: '8080' }),
  MONGODB_URI: Type.String(),
  DB_NAME: Type.String(),
  LOG_LEVEL: Type.Union([
    Type.Literal('trace'),
    Type.Literal('debug'),
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error'),
    Type.Literal('fatal')
  ], { default: 'info' }),
  FIREBASE_PROJECT_ID: Type.String(),
  FIREBASE_PRIVATE_KEY: Type.String(),
  FIREBASE_CLIENT_EMAIL: Type.String(),
  // GCP Configuration (only project ID needed for Cloud Run)
  GCP_PROJECT_ID: Type.Optional(Type.String()),
  // Anthropic Configuration (optional for local dev without AI features)
  ANTHROPIC_API_KEY: Type.Optional(Type.String()),
  ANTHROPIC_MODEL: Type.String({ default: 'claude-3-haiku-20240307' }),
  // OpenAI Configuration (optional for local dev without AI features)
  OPENAI_API_KEY: Type.Optional(Type.String()),
});

type Config = Static<typeof ConfigSchema>;

let config: Config | null = null;

export function validateConfig(): Config {
  if (config) return config;
  
  const env = {} as Record<string, string | undefined>;
  
  // Required fields with defaults
  const requiredFields = [
    'NODE_ENV', 'PORT', 'MONGODB_URI', 'DB_NAME', 'LOG_LEVEL',
    'FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'
  ];
  
  // Optional fields (e.g. for local dev without AI or GCP)
  const optionalFields = [
    'GCP_PROJECT_ID', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'
  ];
  
  // Process required fields
  for (const key of requiredFields) {
    const schemaProperty = ConfigSchema.properties[key as keyof typeof ConfigSchema.properties];
    env[key] = process.env[key] || ('default' in schemaProperty ? schemaProperty.default : undefined);
    
    if (env[key] === undefined) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  
  // Process optional fields
  for (const key of optionalFields) {
    env[key] = process.env[key];
  }
  
  config = env as Config;
  return config;
}

export function getConfig(key: keyof Config): string | undefined {
  const validatedConfig = validateConfig();
  return validatedConfig[key] as string | undefined;
} 