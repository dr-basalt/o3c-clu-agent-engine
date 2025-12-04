# O3C-CLU-AGENT-ENGINE

**Multi-tenant SaaS wrapper for RowboatX**

A production-ready, headless-first platform that wraps RowboatX and exposes it through modern REST APIs and OpenAI-compatible endpoints. Perfect for building AI agent platforms with complete user isolation, scheduling, and provider management.

---

## 🎯 Features

- ✅ **Multi-tenant Architecture** - Complete user workspace isolation
- ✅ **OpenAI-Compatible API** - Drop-in replacement for OpenAI SDK
- ✅ **Provider Management** - Support for OpenAI, Anthropic, Custom providers
- ✅ **Agent Scheduling** - Cron-based scheduled executions with BullMQ
- ✅ **Real-time Logs** - Server-Sent Events (SSE) for live execution monitoring
- ✅ **Production Ready** - Docker, Kubernetes, Coolify deployment support
- ✅ **Secure by Default** - JWT auth, API keys, encrypted credentials
- ✅ **Fully Documented** - Swagger/OpenAPI 3.0 auto-generated docs

---

## 📋 Tech Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: NestJS (modular architecture)
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **Validation**: Zod + class-validator
- **Documentation**: Swagger/OpenAPI 3.0

### Infrastructure
- **Container**: Docker multi-stage builds
- **Orchestration**: Docker Compose / Kubernetes
- **Storage**: Persistent volumes for user workspaces
- **Monitoring**: Health endpoints + Prometheus metrics (ready)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- RowboatX installed globally: `npm install -g rowboatx`

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourorg/o3c-clu-agent-engine
cd o3c-clu-agent-engine

# Run setup script (installs deps, starts DB, runs migrations)
./scripts/setup-dev.sh

# Start development
pnpm dev
```

The API will be available at:
- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health

### Test Credentials (from seed)
- **Email**: `demo@o3c.dev`
- **Password**: `password123`

---

## 🏗️ Project Structure

```
o3c-clu-agent-engine/
├── apps/
│   └── api/                    # NestJS Backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/       # JWT Authentication & User management
│       │   │   ├── providers/  # Provider configs (OpenAI, Anthropic, etc.)
│       │   │   ├── agents/     # Agent CRUD & execution
│       │   │   ├── executions/ # Run history & logs (SSE support)
│       │   │   ├── scheduler/  # Cron scheduling with BullMQ
│       │   │   ├── rowboat/    # RowboatX wrapper service
│       │   │   └── openai-proxy/ # OpenAI-compatible API
│       │   ├── common/         # Guards, decorators, interceptors
│       │   └── main.ts
│       ├── prisma/
│       │   ├── schema.prisma   # Database schema
│       │   └── seed.ts         # Seed data
│       └── Dockerfile
│
├── packages/
│   ├── shared-types/           # TypeScript types shared across apps
│   └── shared-config/          # Config constants
│
├── scripts/
│   ├── setup-dev.sh           # Development setup
│   └── deploy-prod.sh         # Production deployment
│
├── docker-compose.yml          # Dev environment
├── docker-compose.prod.yml     # Production (Coolify-ready)
├── .env.example               # Environment variables template
└── README.md
```

---

## 📚 API Documentation

### Authentication

All endpoints except `/auth/register` and `/auth/login` require authentication via:
- **JWT Bearer Token** (for web/frontend)
- **API Key** (for headless/programmatic access via `X-API-Key` header)

### Core Endpoints

#### Auth Module
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login (returns JWT)
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/api-keys` - Generate new API key

#### Providers Module
- `GET /api/v1/providers` - List provider configs
- `POST /api/v1/providers` - Create provider config
- `PUT /api/v1/providers/:id` - Update provider
- `DELETE /api/v1/providers/:id` - Delete provider
- `POST /api/v1/providers/:id/test` - Test connection

#### Agents Module
- `GET /api/v1/agents` - List agents (paginated)
- `POST /api/v1/agents` - Create agent
- `GET /api/v1/agents/:id` - Get agent details
- `PUT /api/v1/agents/:id` - Update agent
- `DELETE /api/v1/agents/:id` - Delete agent
- `POST /api/v1/agents/:id/execute` - Execute agent
- `POST /api/v1/agents/:id/schedule` - Set cron schedule
- `DELETE /api/v1/agents/:id/schedule` - Remove schedule

#### Executions Module
- `GET /api/v1/executions` - List executions (filterable)
- `GET /api/v1/executions/:id` - Get execution details
- `GET /api/v1/executions/:id/logs` - Get execution logs
- `GET /api/v1/executions/:id/logs/stream` - Stream logs (SSE)
- `POST /api/v1/executions/:id/cancel` - Cancel execution
- `POST /api/v1/executions/:id/input` - Provide input (if waiting)

#### OpenAI-Compatible API
- `POST /v1/chat/completions` - Chat completion (use `model: "agent:{agent_id}"`)
- `GET /v1/runs/:runId` - Get run status (for async mode)

### OpenAI API Usage Example

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://your-domain.com',
  apiKey: 'your_api_key_here',
});

// Sync execution (waits for result)
const response = await client.chat.completions.create({
  model: 'agent:550e8400-e29b-41d4-a716-446655440000',
  messages: [
    { role: 'user', content: 'Analyze my latest emails' }
  ],
});

// Async execution (returns immediately with runId)
const asyncResponse = await client.chat.completions.create({
  model: 'agent:550e8400-e29b-41d4-a716-446655440000',
  messages: [
    { role: 'user', content: 'Analyze my latest emails' }
  ],
  metadata: { run_async: true }
});

// Poll for completion
const result = await fetch(`https://your-domain.com/v1/runs/${asyncResponse.id}`);
```

---

## 🔐 Security

### Best Practices Implemented

- ✅ **Password Hashing**: bcrypt with cost 12
- ✅ **JWT Tokens**: Short-lived access tokens (15min) + refresh tokens (7d)
- ✅ **API Key Hashing**: SHA-256 for stored API keys
- ✅ **Credential Encryption**: AES-256-GCM for provider API keys
- ✅ **Rate Limiting**: Express rate limit on all endpoints
- ✅ **Input Validation**: Zod schemas + class-validator
- ✅ **CORS**: Configured restrictively
- ✅ **Helmet.js**: Security headers
- ✅ **Workspace Isolation**: Per-user filesystem isolation

### Environment Variables

**Critical secrets** (generate with `openssl rand -base64 32`):
- `JWT_SECRET` - JWT signing key
- `JWT_REFRESH_SECRET` - Refresh token signing key
- `ENCRYPTION_KEY` - For encrypting provider API keys
- `POSTGRES_PASSWORD` - Database password

---

## 🐳 Deployment

### Option 1: Docker Compose (Development)

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Docker Compose Production (Coolify)

```bash
# Copy and configure environment
cp .env.example .env
nano .env  # Fill in all required variables

# Deploy
./scripts/deploy-prod.sh

# Or manually:
docker-compose -f docker-compose.prod.yml up -d
```

### Option 3: Kubernetes (TODO)

Kubernetes manifests will be added in the `k8s/` directory for:
- StatefulSet for PostgreSQL
- Deployment for API
- Deployment for Workers (scaled)
- Services, Ingress, PVCs

---

## 🔧 Configuration

### Database Schema

The project uses Prisma ORM. Key tables:
- **users** - User accounts with workspace isolation
- **provider_configs** - Provider API configurations (encrypted)
- **agents** - Agent definitions with MCP servers and tools
- **execution_runs** - Execution history with logs

### Migrations

```bash
# Generate Prisma client
cd apps/api
pnpm prisma generate

# Create migration
pnpm prisma migrate dev --name migration_name

# Apply migrations (production)
pnpm prisma migrate deploy

# View database
pnpm prisma studio
```

### Workspace Isolation

Each user gets an isolated workspace at `/data/workspaces/{workspace_id}/`:
```
/data/workspaces/
└── ws_abc123def456/
    └── .rowboat/
        └── config/
            └── models.json  # Auto-synced from provider configs
```

---

## 📊 Monitoring

### Health Endpoints

- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/ready` - Readiness probe (checks DB connection)
- `GET /api/v1/health/metrics` - System metrics (memory, CPU, uptime)

### Prometheus Metrics (Ready to implement)

```typescript
// Example metrics to expose
- agent_executions_total (counter)
- agent_execution_duration_seconds (histogram)
- active_agents_count (gauge)
- pending_jobs_count (gauge)
- api_requests_total (counter)
```

---

## 🧪 Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

---

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm dev                 # Start all apps in dev mode
pnpm build               # Build all apps
pnpm lint                # Lint code
pnpm format              # Format code

# Database
pnpm db:migrate          # Run migrations
pnpm db:generate         # Generate Prisma client
pnpm db:seed             # Seed database

# Docker
pnpm docker:build        # Build Docker images
pnpm docker:up           # Start containers
pnpm docker:down         # Stop containers
```

### Adding a New Module

1. Create module directory in `apps/api/src/modules/`
2. Create `module-name.module.ts`, `module-name.service.ts`, `module-name.controller.ts`
3. Import module in `app.module.ts`
4. Add routes to Swagger config
5. Write tests in `module-name.spec.ts`

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🆘 Support

- **Documentation**: See `/api/docs` when running
- **Issues**: https://github.com/yourorg/o3c-clu-agent-engine/issues
- **Discussions**: https://github.com/yourorg/o3c-clu-agent-engine/discussions

---

## 🎯 Roadmap

### MVP (Phase 1) ✅
- [x] Auth module (JWT + API keys)
- [x] Provider CRUD with encryption
- [x] Agent CRUD
- [x] RowboatX wrapper with workspace isolation
- [x] Manual agent execution
- [x] Docker compose for dev
- [x] OpenAI-compatible API

### Phase 2 (In Progress)
- [x] BullMQ scheduler
- [x] Cron scheduling
- [x] Execution history
- [x] Real-time logs (SSE)
- [ ] Frontend UI (Next.js)
- [ ] Kubernetes manifests

### Phase 3 (Future)
- [ ] Team workspaces (multi-user)
- [ ] Webhook notifications
- [ ] Agent templates marketplace
- [ ] Cost tracking per agent
- [ ] Advanced monitoring dashboard
- [ ] CLI tool for headless usage

---

## 📞 Contact

Created by **[Your Name]**
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: you@example.com

---

**Built with ❤️ using NestJS, Prisma, and RowboatX**
