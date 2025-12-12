# RowboatX TTY Service - Documentation Complète

Ce document décrit le service TTY rowboatx avec streaming et NLP intégré, permettant d'utiliser rowboatx comme service via une URL de stream.

---

## 🎯 Vue d'ensemble

Le service TTY rowboatx permet de:
- **Streamer** les interactions avec rowboatx via une URL (Server-Sent Events)
- **Parser** les commandes en langage naturel selon le protocole sémantique rowboat
- **Découvrir** automatiquement les agents et workflows dans `~/.rowboat/agents`
- **Gérer** des workflows comme pipelines d'agents
- **Interagir** avec l'API en langage naturel plutôt que JSON

---

## 📚 Architecture

### Modules créés

1. **Workflows Module** (`apps/api/src/modules/workflows/`)
   - Service de gestion de workflows (pipelines d'agents)
   - CRUD complet pour workflows et étapes
   - Exécution séquentielle d'agents

2. **Discovery Module** (`apps/api/src/modules/discovery/`)
   - Scan automatique de `~/.rowboat/agents`
   - Import d'agents découverts dans la DB
   - Synchronisation workspace ↔ database

3. **TTY Stream Module** (`apps/api/src/modules/tty-stream/`)
   - Service de streaming via SSE
   - Parser NLP sémantique
   - Interprétation des commandes rowboat

### Nouveaux modèles Prisma

```prisma
model Workflow {
  id          String
  name        String
  description String?
  steps       WorkflowStep[]
  executions  WorkflowExecution[]
}

model WorkflowStep {
  id           String
  workflowId   String
  agentId      String
  order        Int
  inputMapping Json    // Mapping des inputs entre étapes
}

model WorkflowExecution {
  id          String
  workflowId  String
  status      String  // pending, running, completed, failed
  currentStep Int
  inputData   Json?
  outputData  Json?
}
```

---

## 🚀 Utilisation

### 1. Discovery - Découvrir les agents locaux

Le service peut scanner le répertoire `~/.rowboat/agents` pour découvrir les agents créés localement par rowboat.

```bash
# Découvrir tous les agents dans ~/.rowboat/agents
curl -X GET http://localhost:3000/api/v1/discovery/agents \
  -H "Authorization: Bearer $TOKEN"
```

Réponse:
```json
{
  "success": true,
  "data": [
    {
      "name": "email-processor",
      "path": "/home/user/.rowboat/agents/email-processor",
      "systemPrompt": "Process and categorize emails",
      "isInDatabase": false,
      "databaseId": null
    }
  ],
  "message": "Discovered 1 agents in workspace"
}
```

**Importer un agent découvert:**

```bash
curl -X POST http://localhost:3000/api/v1/discovery/agents/email-processor/import \
  -H "Authorization: Bearer $TOKEN"
```

**Synchroniser automatiquement tous les agents:**

```bash
curl -X POST http://localhost:3000/api/v1/discovery/agents/sync \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Workflows - Créer des pipelines d'agents

Les workflows permettent d'enchaîner plusieurs agents en séquence.

**Créer un workflow:**

```bash
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Email Processing Pipeline",
    "description": "Fetch, analyze, and summarize emails",
    "steps": [
      {
        "agentId": "agent-uuid-1",
        "order": 0,
        "inputMapping": {},
        "metadata": { "stepName": "Fetch Emails" }
      },
      {
        "agentId": "agent-uuid-2",
        "order": 1,
        "inputMapping": { "emails": "output" },
        "metadata": { "stepName": "Analyze" }
      }
    ]
  }'
```

**Exécuter un workflow:**

```bash
curl -X POST http://localhost:3000/api/v1/workflows/{workflow-id}/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {
      "emailFilter": "unread",
      "maxCount": 50
    }
  }'
```

**Suivre l'exécution:**

```bash
curl -X GET http://localhost:3000/api/v1/workflows/executions/{execution-id} \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Service TTY avec NLP - Langage Naturel

Le service TTY permet d'envoyer des commandes en langage naturel qui seront parsées et exécutées.

**Protocole supporté (basé sur rowboat):**

- `"Create agent to <task>"`
- `"Attach tools from <mcp-server-name> to the agent"`
- `"Allow the agent to run shell commands"`
- `"Make agent <name> run every day at 10 AM"`
- `"What agents do I have scheduled to run"`
- `"When was <agent-name> last run"`
- `"Run agent <name> with input <text>"`
- `"Add MCP server: <config>"`
- `"What tools are there in <server-name>"`

**Exemple d'utilisation:**

```bash
# Envoyer une commande en langage naturel
curl -X POST http://localhost:3000/api/v1/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Create agent to analyze GitHub repositories"
  }'
```

Réponse:
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "streamUrl": "/api/v1/tty/stream/550e8400-e29b-41d4-a716-446655440000",
    "message": "Command processing started. Connect to streamUrl for output."
  }
}
```

**Stream les résultats en temps réel (SSE):**

```bash
curl -N -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/tty/stream/550e8400-e29b-41d4-a716-446655440000
```

Output stream (Server-Sent Events):
```
data: {"type":"command","data":{"parsed":{"intent":"create_agent","entities":{"purpose":"analyze GitHub repositories"}}},"timestamp":"2024-12-12T10:30:00.000Z"}

data: {"type":"status","data":{"message":"Creating agent for: analyze GitHub repositories"},"timestamp":"2024-12-12T10:30:01.000Z"}

data: {"type":"output","data":{"message":"Agent created successfully","agent":{"id":"abc123","name":"Agent for analyze GitHub repositories"}},"timestamp":"2024-12-12T10:30:02.000Z"}
```

**Autres exemples de commandes:**

```bash
# Lister les agents
curl -X POST http://localhost:3000/api/v1/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "What agents do I have scheduled to run"}'

# Programmer un agent
curl -X POST http://localhost:3000/api/v1/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Make agent Email Manager run every day at 10 AM"}'

# Exécuter un agent
curl -X POST http://localhost:3000/api/v1/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Run agent Email Manager with input check new emails"}'
```

---

## 🔧 Cas d'usage complexe

### Scénario: Directus + MCP + GraphQL + Rowboat

L'objectif est de créer une API GraphQL dans Directus qui reflète la structure agentique locale de rowboatx.

**Étapes:**

1. **Ajouter MCP Jungle** (gestionnaire de MCP servers)
```bash
curl -X POST http://localhost:3000/api/v1/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Add MCP server: mcp-jungle with command npx -y @modelcontextprotocol/mcp-jungle"}'
```

2. **Ajouter MCP Directus**
```bash
curl -X POST http://localhost:3000/api/v1/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Add MCP server: directus with command npx -y @modelcontextprotocol/server-directus"}'
```

3. **Créer un agent avec les tools Directus**
```bash
curl -X POST http://localhost:3000/api/v1/tty/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "Create agent to manage Directus collections and attach tools from directus to the agent"}'
```

4. **Découvrir les agents locaux et les synchroniser**
```bash
# Découvrir
curl -X GET http://localhost:3000/api/v1/discovery/agents \
  -H "Authorization: Bearer $TOKEN"

# Synchroniser dans l'API
curl -X POST http://localhost:3000/api/v1/discovery/agents/sync \
  -H "Authorization: Bearer $TOKEN"
```

5. **Créer un workflow pour peupler Directus**
```bash
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sync Agents to Directus GraphQL",
    "description": "Populate Directus with local rowboat agents for GraphQL exposure",
    "steps": [
      {
        "agentId": "discovery-agent-id",
        "order": 0,
        "metadata": { "stepName": "Discover local agents" }
      },
      {
        "agentId": "directus-agent-id",
        "order": 1,
        "inputMapping": { "agents": "discovered_agents" },
        "metadata": { "stepName": "Create Directus items" }
      },
      {
        "agentId": "graphql-agent-id",
        "order": 2,
        "inputMapping": { "schema": "directus_schema" },
        "metadata": { "stepName": "Generate GraphQL schema" }
      }
    ]
  }'
```

---

## 🌐 Déploiement

### Docker / Coolify

Le service est prêt pour Coolify. Voir [COOLIFY.md](./COOLIFY.md) pour les instructions.

### Kubernetes / Kubero / Rancher

Des manifests Kubernetes complets sont fournis dans `k8s/`. Voir [k8s/README.md](./k8s/README.md).

**Quick start Kubernetes:**

```bash
# Appliquer tous les manifests
cd k8s
kubectl apply -f .

# Vérifier le déploiement
kubectl get pods -n o3c-agent-engine
kubectl get ingress -n o3c-agent-engine
```

**Configuration Hetzner + Cloudflare:**

1. Créer un Load Balancer Hetzner pointant vers votre cluster K8s
2. Configurer Cloudflare:
   - A record: `api.your-domain.com` → IP Hetzner LB
   - Proxy activé (orange cloud)
   - SSL/TLS: Full (strict)

---

## 📊 Swagger / OpenAPI

L'API génère automatiquement la documentation Swagger/OpenAPI accessible à:

```
http://localhost:3000/api/docs
```

Le fichier OpenAPI.json est disponible à:

```
http://localhost:3000/api/docs-json
```

**Endpoints principaux:**

- `/api/v1/workflows` - CRUD workflows
- `/api/v1/workflows/{id}/execute` - Exécuter un workflow
- `/api/v1/discovery/agents` - Découvrir agents
- `/api/v1/discovery/agents/sync` - Synchroniser agents
- `/api/v1/tty/command` - Envoyer commande NLP
- `/api/v1/tty/stream/{sessionId}` - Stream SSE

---

## 🧪 Tests

### Comptes de test

Après seeding, ces comptes sont disponibles:

```
Main Demo Account:
  Email: demo@o3c.dev
  Password: password123

Additional Test Accounts:
  alice@o3c.dev / alice123
  bob@o3c.dev / bob123
```

### Données de test

- **3 agents** créés (Demo Agent, Email Manager, Data Analyzer)
- **1 workflow** créé (Email Processing Pipeline)
- **Providers** configurés (OpenAI)

### Exemples curl complets

Voir [CURL-EXAMPLES.md](./CURL-EXAMPLES.md) pour tous les exemples de tests.

---

## 🔒 Sécurité

- **JWT Authentication** avec tokens courts (15min)
- **API Keys** pour accès programmatique
- **Workspace Isolation** - Chaque utilisateur a son workspace isolé
- **Encryption** des clés API de providers (AES-256-GCM)
- **Rate Limiting** configurable
- **CORS** configuré

---

## 📈 Monitoring

### Health Endpoints

```bash
# Basic health
curl http://localhost:3000/api/v1/health

# Readiness (DB check)
curl http://localhost:3000/api/v1/health/ready

# Metrics
curl http://localhost:3000/api/v1/health/metrics
```

### Logs

```bash
# Docker
docker-compose logs -f api

# Kubernetes
kubectl logs -f deployment/o3c-api -n o3c-agent-engine
```

---

## 🎓 Exemples d'intégration

### OpenAI SDK

Utiliser l'API comme drop-in replacement pour OpenAI:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://your-domain.com',
  apiKey: 'your-api-key',
});

const response = await client.chat.completions.create({
  model: 'agent:550e8400-e29b-41d4-a716-446655440000',
  messages: [
    { role: 'user', content: 'Analyze my emails' }
  ],
});
```

### Python

```python
import requests

# Login
response = requests.post(
    'http://localhost:3000/api/v1/auth/login',
    json={'email': 'demo@o3c.dev', 'password': 'password123'}
)
token = response.json()['data']['accessToken']

# Send NLP command
response = requests.post(
    'http://localhost:3000/api/v1/tty/command',
    headers={'Authorization': f'Bearer {token}'},
    json={'command': 'List all workflows'}
)
print(response.json())
```

---

## 🛠️ Développement

### Ajouter un nouveau pattern NLP

Éditez `apps/api/src/modules/tty-stream/nlp-parser.service.ts`:

```typescript
{
  intent: 'my_new_intent' as CommandIntent,
  patterns: [
    /my\s+regex\s+pattern/i,
  ],
  extractEntities: (match: RegExpMatchArray) => ({
    entity1: match[1]?.trim(),
  }),
}
```

### Étendre le service TTY

Éditez `apps/api/src/modules/tty-stream/tty-stream.service.ts` et ajoutez:

```typescript
private async handleMyNewIntent(
  userId: string,
  stream: Subject<StreamMessage>,
  entities: Record<string, any>
): Promise<void> {
  // Votre logique ici
}
```

---

## 📞 Support

- **Documentation**: `/api/docs` (Swagger)
- **Exemples**: [CURL-EXAMPLES.md](./CURL-EXAMPLES.md)
- **Déploiement Kubernetes**: [k8s/README.md](./k8s/README.md)
- **Issues**: GitHub Issues

---

**Built with ❤️ using NestJS, Prisma, RowboatX, and Claude**
