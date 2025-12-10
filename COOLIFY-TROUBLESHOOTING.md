# Guide de Dépannage Coolify

Guide pour résoudre les problèmes courants lors du déploiement sur Coolify.

---

## 🔧 Problèmes Courants

### 1. Erreur de Permissions (EACCES)

**Symptômes:**
```
EACCES: permission denied, unlink '/app/node_modules/.pnpm/@prisma+client@...'
EACCES: permission denied, open '/app/_tmp_...'
```

**Cause:**
L'utilisateur `nodejs` dans le container n'a pas les permissions d'écriture sur `/app`.

**Solution:**
✅ **CORRIGÉ** - Le Dockerfile a été mis à jour pour donner les bonnes permissions.

Si vous rencontrez toujours ce problème:
1. Redéployez l'application pour utiliser le nouveau Dockerfile
2. Ou ajoutez manuellement dans Coolify: Paramètres → Build → Build Command:
   ```bash
   docker build -t my-app --build-arg UID=1001 .
   ```

---

### 2. Variable DATABASE_URL Manquante

**Symptômes:**
```
Error: Environment variable not found: DATABASE_URL.
```

**Cause:**
Les variables d'environnement ne sont pas configurées dans Coolify.

**Solution:**

#### Variables d'Environnement Requises dans Coolify

Allez dans **Coolify → Votre Service API → Environment Variables** et ajoutez:

```bash
# Base de données (Coolify les génère automatiquement si vous utilisez un service PostgreSQL)
POSTGRES_DB=o3c_agent_engine
POSTGRES_USER=o3c_user
POSTGRES_PASSWORD=votre_mot_de_passe_securise

# Secrets (générer avec: openssl rand -base64 32)
JWT_SECRET=votre_secret_jwt_ici
JWT_REFRESH_SECRET=votre_secret_refresh_ici
ENCRYPTION_KEY=votre_cle_encryption_ici

# Domaines
API_BASE_URL=https://votre-domaine.com
FRONTEND_URL=https://app.votre-domaine.com

# Options (optionnel)
PORT=3000
LOG_LEVEL=info
NODE_ENV=production

# Auto-seed (pour le premier déploiement)
AUTO_SEED=true
```

**Note Importante:**
- Si vous utilisez un service PostgreSQL géré par Coolify, ces variables sont automatiquement injectées
- Le `DATABASE_URL` est construit automatiquement dans le `docker-entrypoint.sh`

---

### 3. Base de Données Non Seedée

**Symptômes:**
```
Login failed - User not found
401 Unauthorized
```

**Cause:**
La base de données est vide (pas de données de test).

**Solutions:**

#### Option A: Auto-seed (Recommandé)

1. Dans Coolify, ajoutez la variable d'environnement:
   ```bash
   AUTO_SEED=true
   ```

2. Redéployez l'application

3. Le seed sera automatiquement exécuté au démarrage si la base est vide

#### Option B: Seed Manuel

1. Connectez-vous au container API:
   ```bash
   # Dans Coolify, allez dans Terminal du service API
   # Ou via SSH:
   docker exec -it <nom-du-container-api> sh
   ```

2. Exécutez le seed:
   ```bash
   cd /app/apps/api
   npx prisma db seed
   ```

3. Vérifiez les credentials affichés dans les logs

#### Option C: Via les Logs Coolify

Si `AUTO_SEED=true` est activé, les credentials seront affichés dans les logs au premier démarrage:

```
🎉 Database seeding completed!

📝 Test credentials:
   Email: demo@o3c.dev
   Password: password123
   API Key: abc123def456...
```

**Sauvegardez l'API Key affichée!**

---

### 4. Prisma Client Non Généré

**Symptômes:**
```
Error: @prisma/client did not initialize yet
Cannot find module '@prisma/client'
```

**Cause:**
Le client Prisma n'a pas été généré après les migrations.

**Solution:**

Le Dockerfile a été corrigé pour générer automatiquement le client. Si le problème persiste:

```bash
# Dans le container
cd /app/apps/api
npx prisma generate
```

---

### 5. Migrations Échouées (P3009)

**Symptômes:**
```
Error: P3009 - Failed migration
```

**Cause:**
Une migration précédente a échoué et est bloquée.

**Solution:**
✅ **CORRIGÉ** - Le `docker-entrypoint.sh` détecte et résout automatiquement ce problème.

Le script:
1. Détecte l'erreur P3009
2. Vérifie si les tables existent
3. Si oui: marque la migration comme appliquée
4. Si non: marque comme rollback et relance

Si vous devez le faire manuellement:

```bash
# Dans le container
cd /app/apps/api

# Vérifier l'état
npx prisma migrate status

# Résoudre une migration bloquée (remplacer par le nom de la migration)
npx prisma migrate resolve --applied "20240101000000_init"

# Ou si vraiment bloquée
npx prisma migrate resolve --rolled-back "20240101000000_init"
npx prisma migrate deploy
```

---

### 6. Container Ne Démarre Pas

**Symptômes:**
Le container redémarre en boucle ou crashe immédiatement.

**Diagnostic:**

1. **Vérifier les logs Coolify**:
   - Allez dans Logs → Container Logs
   - Cherchez les erreurs au démarrage

2. **Vérifier les variables d'environnement**:
   - Assurez-vous que toutes les variables requises sont définies
   - Vérifiez qu'il n'y a pas d'espaces ou de caractères spéciaux non échappés

3. **Vérifier la connexion PostgreSQL**:
   ```bash
   # Dans le container
   PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;"
   ```

4. **Vérifier la connexion Redis** (si utilisé):
   ```bash
   # Dans le container
   redis-cli -h redis ping
   ```

---

### 7. API Accessible mais Retourne 502/504

**Symptômes:**
Le container tourne mais l'API retourne des erreurs 502 ou 504.

**Causes Possibles:**

1. **L'application n'écoute pas sur le bon port**:
   - Vérifiez que `PORT=3000` (ou votre port configuré)
   - Vérifiez que le healthcheck passe: `curl http://localhost:3000/api/v1/health`

2. **Coolify Proxy mal configuré**:
   - Vérifiez le port dans Coolify → Settings → Ports (doit être 3000)
   - Vérifiez que le chemin healthcheck est configuré: `/api/v1/health`

3. **Application crashe après démarrage**:
   - Vérifiez les logs pour des erreurs après le démarrage
   - Vérifiez la connexion aux dépendances (DB, Redis)

---

## 🚀 Checklist de Déploiement

Avant de déployer sur Coolify, assurez-vous que:

- [ ] **Service PostgreSQL** est créé et lié à votre application
- [ ] **Service Redis** est créé et lié (si vous utilisez BullMQ/scheduling)
- [ ] **Variables d'environnement** sont toutes configurées:
  - [ ] `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  - [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`
  - [ ] `API_BASE_URL`, `FRONTEND_URL`
  - [ ] `AUTO_SEED=true` (pour premier déploiement)
- [ ] **Build Settings** dans Coolify:
  - [ ] Dockerfile Path: `apps/api/Dockerfile`
  - [ ] Context: `.` (racine du repo)
- [ ] **Port**: 3000 est exposé
- [ ] **Health Check**: Path = `/api/v1/health`
- [ ] **Persistent Storage** (optionnel):
  - [ ] Volume pour `/data` (workspaces des utilisateurs)

---

## 🔍 Commandes Utiles

### Vérifier l'état de l'application

```bash
# Healthcheck
curl https://votre-domaine.com/api/v1/health

# Swagger docs
curl https://votre-domaine.com/api/docs

# OpenAPI JSON
curl https://votre-domaine.com/api/docs-json > openapi.json
```

### Dans le Container

```bash
# Se connecter au container
docker exec -it <container-name> sh

# Vérifier les migrations
cd /app/apps/api
npx prisma migrate status

# Vérifier les données
npx prisma studio  # Ouvre une UI (besoin de port forwarding)

# Ou via psql
PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT email FROM users;"

# Seed manuel
npx prisma db seed

# Générer le client Prisma
npx prisma generate

# Relancer les migrations
npx prisma migrate deploy
```

### Vérifier les Logs

```bash
# Via Coolify UI
# Logs → Container Logs

# Via Docker (si accès SSH)
docker logs <container-name> --tail 100 -f

# Logs spécifiques
docker logs <container-name> 2>&1 | grep -i error
docker logs <container-name> 2>&1 | grep -i "database"
```

---

## 📊 Variables d'Environnement Complètes

Voici toutes les variables supportées:

### Obligatoires

```bash
# Database
POSTGRES_DB=o3c_agent_engine
POSTGRES_USER=o3c_user
POSTGRES_PASSWORD=<généré-par-coolify>

# Secrets (générer avec: openssl rand -base64 32)
JWT_SECRET=<secret-32-chars>
JWT_REFRESH_SECRET=<secret-32-chars>
ENCRYPTION_KEY=<secret-32-chars>

# API URLs
API_BASE_URL=https://api.votredomaine.com
FRONTEND_URL=https://app.votredomaine.com
```

### Optionnelles

```bash
# Application
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Auto-seed (première installation)
AUTO_SEED=true

# Performance
WORKER_CONCURRENCY=5
MAX_JOB_DURATION_MS=300000

# Security
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
ENABLE_METRICS=true
```

---

## 🆘 Besoin d'Aide?

1. **Vérifiez les logs Coolify** en premier
2. **Consultez la documentation principale**: [COOLIFY.md](./COOLIFY.md)
3. **Guide de test de l'API**: [API-TESTING-GUIDE.md](./API-TESTING-GUIDE.md)
4. **Créez une issue** sur GitHub avec:
   - Les logs du container
   - Les variables d'environnement (sans les valeurs sensibles)
   - Les étapes pour reproduire le problème

---

## 🔄 Procédure de Redéploiement

Si vous avez des problèmes persistants:

1. **Sauvegarder les données importantes** (si existantes)

2. **Redéployer l'application**:
   ```bash
   # Dans Coolify
   # Actions → Restart → Hard Restart
   # Ou
   # Actions → Rebuild
   ```

3. **Vérifier les logs au démarrage**:
   - Migrations exécutées ✓
   - Seed exécuté ✓ (si AUTO_SEED=true)
   - Application démarrée sur port 3000 ✓

4. **Tester l'API**:
   ```bash
   # Depuis votre machine locale
   curl https://votre-domaine.com/api/v1/health

   # Login
   curl -X POST https://votre-domaine.com/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "demo@o3c.dev", "password": "password123"}'
   ```

5. **Désactiver AUTO_SEED** après le premier déploiement réussi:
   ```bash
   # Dans Coolify, supprimer ou mettre à false
   AUTO_SEED=false
   ```

---

**Dernière mise à jour**: 2024-12-10
