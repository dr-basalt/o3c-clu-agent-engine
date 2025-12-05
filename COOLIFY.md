# Déploiement sur Coolify

Ce guide explique comment déployer **o3c-clu-agent-engine** sur Coolify.

## 🚨 Prérequis

- Serveur Coolify configuré
- Domaine configuré (DNS pointant vers le serveur)
- Accès au repository Git

---

## 📝 Étape 1: Configuration dans Coolify

### Créer un nouveau projet

1. **Aller dans Coolify** → New Resource → Docker Compose
2. **Repository Git**: Sélectionner votre repository
3. **Branch**: `claude/rowboatx-saas-wrapper-01LRjPXoz9uJ238D8rTbCteY`
4. **Docker Compose File**: `docker-compose.prod.yml`

### Configurer les variables d'environnement

Dans Coolify, aller dans **Environment Variables** et ajouter:

#### Variables Requises

```bash
# Domaines
API_DOMAIN=api.votredomaine.com
API_BASE_URL=https://api.votredomaine.com
FRONTEND_URL=https://app.votredomaine.com

# Database
POSTGRES_DB=o3c_agent_engine
POSTGRES_USER=o3c_user
POSTGRES_PASSWORD=<générer-mot-de-passe-sécurisé>

# Redis
REDIS_PASSWORD=<générer-mot-de-passe-sécurisé>

# Secrets (générer avec: openssl rand -base64 32)
JWT_SECRET=<générer-secret-32-caractères>
JWT_REFRESH_SECRET=<générer-secret-32-caractères>
ENCRYPTION_KEY=<générer-secret-32-caractères>
```

#### Variables Optionnelles

```bash
# Performance
WORKER_CONCURRENCY=5
MAX_JOB_DURATION_MS=300000

# Sécurité
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
ENABLE_METRICS=true
LOG_LEVEL=info
```

---

## 🔐 Étape 2: Générer les Secrets

```bash
# Sur votre machine locale, générez les secrets:
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
```

Copiez ces valeurs dans les variables d'environnement Coolify.

---

## 🌐 Étape 3: Configuration DNS

Configurez votre domaine pour pointer vers le serveur Coolify:

```
Type: A
Host: api.votredomaine.com
Value: <IP-de-votre-serveur-Coolify>
TTL: 300
```

---

## 🚀 Étape 4: Déploiement

1. **Dans Coolify**, cliquez sur **Deploy**
2. Attendez que le build se termine (peut prendre 5-10 minutes)
3. Vérifiez les logs pour confirmer le démarrage

---

## ✅ Étape 5: Vérification

### Vérifier la santé de l'API

```bash
curl https://api.votredomaine.com/api/v1/health
```

Réponse attendue:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "uptime": 123.456
}
```

### Accéder à la documentation

Ouvrez dans votre navigateur:
```
https://api.votredomaine.com/api/docs
```

---

## 🔧 Étape 6: Initialiser la base de données

### Option 1: Via Coolify Terminal

1. Dans Coolify, allez dans **Containers** → Service `api`
2. Cliquez sur **Terminal**
3. Exécutez:

```bash
cd apps/api
pnpm prisma migrate deploy
pnpm prisma db seed
```

### Option 2: Via SSH

```bash
# Se connecter au serveur
ssh user@votre-serveur.com

# Trouver le container API
docker ps | grep o3c-agent-api

# Exécuter les migrations
docker exec -it <container-id> sh -c "cd apps/api && pnpm prisma migrate deploy && pnpm prisma db seed"
```

---

## 📊 Monitoring

### Voir les logs

Dans Coolify:
- **Service API**: Containers → api → Logs
- **PostgreSQL**: Containers → postgres → Logs
- **Redis**: Containers → redis → Logs

### Endpoints de monitoring

```bash
# Health check
curl https://api.votredomaine.com/api/v1/health

# Readiness (vérifie DB)
curl https://api.votredomaine.com/api/v1/health/ready

# Metrics
curl https://api.votredomaine.com/api/v1/health/metrics
```

---

## 🐛 Troubleshooting

### Problème: Build échoue

**Erreur**: `port is already allocated`

**Solution**: Les ports sont gérés par Traefik, pas besoin d'exposition directe. Le fichier `docker-compose.prod.yml` a été corrigé pour retirer les ports.

---

### Problème: Database connection failed

**Cause**: Base de données pas prête

**Solution**: Attendez que le health check PostgreSQL passe au vert. Les services démarrent dans l'ordre:
1. postgres (attend health check)
2. redis (attend health check)
3. api (démarre après postgres + redis)

---

### Problème: Migrations non appliquées

**Erreur**: `Table 'users' doesn't exist`

**Solution**: Exécutez les migrations manuellement:
```bash
docker exec -it <api-container-id> sh -c "cd apps/api && pnpm prisma migrate deploy"
```

---

### Problème: 502 Bad Gateway

**Causes possibles**:
1. API pas encore démarrée (patientez 2-3 minutes)
2. Health check échoue
3. Variables d'environnement manquantes

**Diagnostic**:
```bash
# Vérifier les logs API
docker logs <api-container-id> --tail 100

# Vérifier le health check
docker exec <api-container-id> wget --spider http://localhost:3000/api/v1/health
```

---

## 🔄 Mise à jour

Pour déployer une nouvelle version:

1. **Push vos changements** vers la branche Git
2. Dans Coolify, cliquez sur **Redeploy**
3. Coolify va:
   - Récupérer le nouveau code
   - Rebuild les images
   - Restart les services avec zero-downtime

---

## 🎯 Credentials de Test

Après le seed, utilisez:
- **Email**: `demo@o3c.dev`
- **Password**: `password123`

**⚠️ Important**: Changez ou supprimez ce compte en production!

---

## 📈 Optimisations Production

### Activer la persistance des volumes

Les volumes sont automatiquement persistés par Coolify:
- `postgres_data`: Base de données
- `redis_data`: Cache Redis
- `workspaces_data`: Workspaces utilisateurs RowboatX

### Scaling

Pour augmenter les ressources:
1. Dans Coolify → Service API → Resources
2. Ajuster:
   - CPU Limit
   - Memory Limit
   - Replicas (si multi-instance)

### Backups

Configurez des backups automatiques:
1. Volume PostgreSQL: Backup quotidien
2. Volume workspaces: Backup hebdomadaire

```bash
# Backup manuel PostgreSQL
docker exec <postgres-container> pg_dump -U o3c_user o3c_agent_engine > backup.sql

# Backup workspaces
docker run --rm -v <workspaces-volume>:/data -v $(pwd):/backup alpine tar czf /backup/workspaces-backup.tar.gz /data
```

---

## ✅ Checklist Post-Déploiement

- [ ] API accessible via domaine
- [ ] Swagger docs accessible
- [ ] Health checks passent
- [ ] Migrations DB appliquées
- [ ] Compte test fonctionne
- [ ] Backups configurés
- [ ] Monitoring actif
- [ ] Logs vérifiés
- [ ] Variables d'environnement sécurisées
- [ ] SSL/TLS actif

---

## 🆘 Support

- **Logs Coolify**: Interface Coolify → Logs
- **Documentation API**: https://api.votredomaine.com/api/docs
- **Issues GitHub**: https://github.com/yourorg/o3c-clu-agent-engine/issues

---

**Déploiement Coolify réussi!** 🎉
