// ========================================
// COMMON CONFIGURATION
// ========================================

export const DEFAULT_CONFIG = {
  // API
  API_PORT: 3000,
  API_PREFIX: '/api/v1',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,

  // JWT
  JWT_EXPIRATION: '15m',
  JWT_REFRESH_EXPIRATION: '7d',

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Agent Execution
  DEFAULT_MAX_ITERATIONS: 10,
  MAX_ITERATIONS_LIMIT: 50,
  DEFAULT_JOB_TIMEOUT_MS: 300000, // 5 minutes

  // Worker
  WORKER_CONCURRENCY: 5,
  MAX_JOB_ATTEMPTS: 3,

  // Workspace
  WORKSPACES_BASE_PATH: '/data/workspaces',
  ROWBOAT_CONFIG_PATH: '.rowboat/config',

  // Logging
  LOG_LEVELS: ['error', 'warn', 'info', 'debug', 'verbose'] as const,
  DEFAULT_LOG_LEVEL: 'info',
} as const;

export const CORS_CONFIG = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
};

export const SWAGGER_CONFIG = {
  title: 'O3C-CLU-AGENT-ENGINE API',
  description: 'Multi-tenant SaaS wrapper for RowboatX',
  version: '1.0',
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Providers', description: 'Provider configuration management' },
    { name: 'Agents', description: 'Agent management' },
    { name: 'Executions', description: 'Execution runs and logs' },
    { name: 'OpenAI', description: 'OpenAI-compatible API' },
  ],
};

export const SECURITY_CONFIG = {
  BCRYPT_ROUNDS: 12,
  API_KEY_LENGTH: 64,
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  HELMET_OPTIONS: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  },
};

export const REDIS_CONFIG = {
  QUEUE_NAME: 'agent-scheduler',
  QUEUE_PREFIX: 'o3c',
  JOB_OPTIONS: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 604800, // 7 days
    },
  },
};

export const HEALTH_CHECK_CONFIG = {
  timeout: 5000,
  memory: {
    heapUsedThreshold: 0.9, // 90%
    rssThreshold: 0.9,
  },
};
