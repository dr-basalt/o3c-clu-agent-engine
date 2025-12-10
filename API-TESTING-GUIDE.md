# Guide de Test de l'API O3C-CLU-AGENT-ENGINE

Guide complet pour tester l'API, obtenir les credentials et récupérer le fichier OpenAPI pour Flowise.

---

## 📋 Table des Matières

1. [Démarrage de l'API](#1-démarrage-de-lapi)
2. [Credentials de Test](#2-credentials-de-test)
3. [Authentification](#3-authentification)
4. [Récupération du Fichier OpenAPI](#4-récupération-du-fichier-openapi)
5. [Test des Endpoints](#5-test-des-endpoints)
6. [Intégration avec Flowise](#6-intégration-avec-flowise)

---

## 1. Démarrage de l'API

### Option A: Mode Développement (Recommandé pour les tests)

```bash
# Installer les dépendances
pnpm install

# Démarrer les services (PostgreSQL + Redis)
docker-compose up -d

# Attendre que la base de données soit prête (environ 10 secondes)
sleep 10

# Générer le client Prisma et lancer les migrations
cd apps/api
pnpm prisma generate
pnpm prisma migrate deploy

# Initialiser les données de test
pnpm prisma db seed

# Démarrer l'API en mode développement
cd ../..
pnpm dev
```

L'API sera disponible à:
- **API**: http://localhost:3000/api/v1
- **Swagger UI**: http://localhost:3000/api/docs
- **OpenAPI JSON**: http://localhost:3000/api/docs-json

### Option B: Mode Docker (Production-like)

```bash
# Configurer l'environnement
cp .env.example .env
# Éditer .env et remplir les secrets nécessaires

# Démarrer avec Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs -f api
```

---

## 2. Credentials de Test

Après avoir exécuté le seed de la base de données, vous aurez accès à un utilisateur de test:

### Credentials par Défaut

```json
{
  "email": "demo@o3c.dev",
  "password": "password123"
}
```

**Note**: L'API Key est générée automatiquement lors du seed. Pour la récupérer, vous devez soit:
- Consulter les logs du seed
- Vous connecter et créer une nouvelle API Key via l'endpoint `/api/v1/auth/api-keys`
- Accéder à la base de données directement

### Récupérer l'API Key depuis la Base de Données

```bash
# Via Prisma Studio (interface graphique)
cd apps/api
pnpm prisma studio
# Naviguer vers la table "users" et copier le champ "apiKey"

# Via CLI PostgreSQL (si Docker)
docker exec -it o3c-postgres psql -U o3c_user -d o3c_agent_engine -c "SELECT email, \"apiKey\" FROM users WHERE email='demo@o3c.dev';"
```

---

## 3. Authentification

### Méthode 1: JWT Bearer Token (Recommandé pour interfaces web)

#### 3.1 Login pour obtenir le JWT

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@o3c.dev",
    "password": "password123"
  }'
```

**Réponse attendue**:
```json
{
  "user": {
    "id": "uuid-here",
    "email": "demo@o3c.dev",
    "name": "Demo User",
    "workspaceId": "ws_abc123"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 3.2 Utiliser le JWT Token

```bash
# Remplacer {ACCESS_TOKEN} par le token obtenu
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

### Méthode 2: API Key (Recommandé pour Flowise et intégrations headless)

#### 3.1 Créer une nouvelle API Key

```bash
# Utiliser le JWT token pour créer une API Key
curl -X POST http://localhost:3000/api/v1/auth/api-keys \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Flowise Integration Key"
  }'
```

**Réponse attendue**:
```json
{
  "id": "uuid-here",
  "name": "Flowise Integration Key",
  "key": "o3c_key_abc123def456789...",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

**⚠️ IMPORTANT**: Sauvegardez immédiatement cette clé API, elle ne sera plus visible après cette requête!

#### 3.2 Utiliser l'API Key

```bash
# Utiliser le header X-API-Key
curl -X GET http://localhost:3000/api/v1/agents \
  -H "X-API-Key: o3c_key_abc123def456789..."
```

---

## 4. Récupération du Fichier OpenAPI

### Méthode 1: Télécharger le JSON (Recommandé)

```bash
# Une fois l'API démarrée, télécharger le fichier OpenAPI
curl http://localhost:3000/api/docs-json > openapi.json

# Ou avec wget
wget http://localhost:3000/api/docs-json -O openapi.json

# Vérifier le contenu
cat openapi.json | jq '.info'
```

### Méthode 2: Via le Navigateur

1. Démarrer l'API
2. Ouvrir: http://localhost:3000/api/docs-json
3. Copier tout le JSON
4. Sauvegarder dans un fichier `openapi.json`

### Méthode 3: Depuis Swagger UI

1. Ouvrir: http://localhost:3000/api/docs
2. Chercher le lien **"Download OpenAPI JSON"** en haut de la page
3. Télécharger le fichier

---

## 5. Test des Endpoints

### 5.1 Health Check

```bash
curl http://localhost:3000/api/v1/health
```

**Réponse attendue**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 5.2 Lister les Agents

```bash
curl -X GET http://localhost:3000/api/v1/agents \
  -H "X-API-Key: YOUR_API_KEY"
```

### 5.3 Créer un Agent

```bash
curl -X POST http://localhost:3000/api/v1/agents \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "description": "Agent de test pour Flowise",
    "systemPrompt": "Tu es un assistant utile qui répond en français.",
    "mcpServers": [],
    "tools": ["shell"],
    "allowShell": true,
    "maxIterations": 10
  }'
```

### 5.4 Exécuter un Agent (Mode Synchrone)

```bash
curl -X POST http://localhost:3000/api/v1/agents/{AGENT_ID}/execute \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Quelle est la date d'\''aujourd'\''hui ?",
    "runAsync": false
  }'
```

### 5.5 Utiliser l'API Compatible OpenAI

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agent:{AGENT_ID}",
    "messages": [
      {
        "role": "user",
        "content": "Bonjour, peux-tu m'\''aider ?"
      }
    ]
  }'
```

---

## 6. Intégration avec Flowise

### 6.1 Prérequis

1. Avoir l'API démarrée (voir section 1)
2. Avoir récupéré le fichier `openapi.json` (voir section 4)
3. Avoir créé une API Key (voir section 3.2)

### 6.2 Configuration dans Flowise

#### Option A: Utiliser l'OpenAPI Custom Tool

1. Dans Flowise, ajouter un nœud **"OpenAPI Custom Tool"**
2. Configuration:
   - **OpenAPI Spec**: Coller le contenu du fichier `openapi.json`
   - **Base URL**: `http://localhost:3000` (ou votre domaine de production)
   - **Authentication Type**: `API Key`
   - **API Key Header Name**: `X-API-Key`
   - **API Key Value**: Coller votre API Key (ex: `o3c_key_abc123...`)

#### Option B: Utiliser l'API Compatible OpenAI

Flowise peut utiliser directement l'API compatible OpenAI:

1. Ajouter un nœud **"OpenAI Chat Model"**
2. Configuration:
   - **Base URL**: `http://localhost:3000`
   - **API Key**: Votre API Key O3C
   - **Model Name**: `agent:{AGENT_ID}` (remplacer par l'ID de votre agent)

### 6.3 Exemple de Workflow Flowise

```yaml
Workflow: "Agent O3C via Flowise"

Nœuds:
  1. Chat Input (User Query)
  2. OpenAPI Tool (O3C Agent API)
     - Endpoint: POST /api/v1/agents/{agent_id}/execute
     - Auth: X-API-Key header
  3. Chat Output (Agent Response)

Configuration OpenAPI Tool:
  - Method: POST
  - Path: /api/v1/agents/{{agent_id}}/execute
  - Headers:
      X-API-Key: "{{api_key}}"
  - Body:
      prompt: "{{user_query}}"
      runAsync: false
```

### 6.4 Test de l'Intégration

1. Créer un agent de test via l'API (voir section 5.3)
2. Noter l'ID de l'agent retourné
3. Configurer Flowise avec cet ID
4. Envoyer un message de test dans le chat Flowise
5. Vérifier que la réponse provient bien de votre agent O3C

---

## 7. Résolution de Problèmes

### Problème: "Cannot connect to API"

**Solution**:
```bash
# Vérifier que l'API est démarrée
curl http://localhost:3000/api/v1/health

# Vérifier les logs
pnpm dev  # Mode dev
# ou
docker-compose logs -f api  # Mode Docker
```

### Problème: "401 Unauthorized"

**Solution**:
- Vérifier que l'API Key est valide
- Vérifier que le header `X-API-Key` est bien présent
- Créer une nouvelle API Key si nécessaire

### Problème: "openapi.json not found"

**Solution**:
```bash
# Attendre que l'API soit complètement démarrée (environ 10-15 secondes)
sleep 15
curl http://localhost:3000/api/docs-json

# Si l'endpoint n'existe pas, essayer:
curl http://localhost:3000/api/docs-yaml
# Puis convertir le YAML en JSON
```

### Problème: Flowise ne peut pas atteindre localhost

**Solution**:
- Si Flowise tourne dans Docker, utiliser `host.docker.internal` au lieu de `localhost`
- Ou exposer l'API sur le réseau:
  ```bash
  # Dans .env
  API_BASE_URL=http://0.0.0.0:3000
  ```

---

## 8. Endpoints Principaux pour Flowise

Voici les endpoints les plus utiles pour créer un agent Flowise:

| Endpoint | Méthode | Description | Auth |
|----------|---------|-------------|------|
| `/api/v1/agents` | GET | Lister les agents | API Key |
| `/api/v1/agents` | POST | Créer un agent | API Key |
| `/api/v1/agents/{id}/execute` | POST | Exécuter un agent | API Key |
| `/v1/chat/completions` | POST | API compatible OpenAI | API Key |
| `/api/v1/executions/{id}/logs/stream` | GET | Stream SSE des logs | API Key |

---

## 9. Exemples avec SDK OpenAI

### Node.js / TypeScript

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000',
  apiKey: 'o3c_key_abc123...',
});

// Utiliser un agent O3C comme modèle OpenAI
const response = await client.chat.completions.create({
  model: 'agent:550e8400-e29b-41d4-a716-446655440000',
  messages: [
    { role: 'user', content: 'Bonjour, comment ça va ?' }
  ],
});

console.log(response.choices[0].message.content);
```

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000",
    api_key="o3c_key_abc123..."
)

response = client.chat.completions.create(
    model="agent:550e8400-e29b-41d4-a716-446655440000",
    messages=[
        {"role": "user", "content": "Bonjour, comment ça va ?"}
    ]
)

print(response.choices[0].message.content)
```

---

## 10. Variables d'Environnement Importantes

Pour configurer l'API en production, assurez-vous de définir:

```bash
# Domaines
API_BASE_URL=https://api.votredomaine.com
FRONTEND_URL=https://app.votredomaine.com

# Sécurité (générer avec: openssl rand -base64 32)
JWT_SECRET=votre_secret_jwt
JWT_REFRESH_SECRET=votre_secret_refresh
ENCRYPTION_KEY=votre_cle_encryption

# Base de données
POSTGRES_DB=o3c_agent_engine
POSTGRES_USER=o3c_user
POSTGRES_PASSWORD=votre_mot_de_passe_securise

# Redis
REDIS_PASSWORD=votre_mot_de_passe_redis

# Performance
WORKER_CONCURRENCY=5
MAX_JOB_DURATION_MS=300000
```

---

## 📞 Support

- **Documentation Swagger**: http://localhost:3000/api/docs
- **README Principal**: [README.md](./README.md)
- **Guide Coolify**: [COOLIFY.md](./COOLIFY.md)

---

**Créé par O3C - Wrapper SaaS Multi-tenant pour RowboatX**
