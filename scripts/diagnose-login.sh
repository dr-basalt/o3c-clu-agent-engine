#!/bin/bash

# Script de diagnostic pour problèmes de login 504

echo "🔍 Diagnostic du problème de login 504"
echo "========================================"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Fonction pour tester
test_step() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ $2${NC}"
  else
    echo -e "${RED}✗ $2${NC}"
  fi
}

# 1. Vérifier les variables d'environnement
echo -e "\n${YELLOW}[1/6] Variables d'environnement${NC}"
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}✗ DATABASE_URL n'est pas définie${NC}"
  echo "Construction depuis les variables..."
  if [ -n "$POSTGRES_PASSWORD" ]; then
    ENCODED_PASSWORD=$(node -e "console.log(encodeURIComponent('$POSTGRES_PASSWORD'))")
    export DATABASE_URL="postgresql://${POSTGRES_USER}:${ENCODED_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"
    echo -e "${GREEN}✓ DATABASE_URL construite${NC}"
  else
    echo -e "${RED}✗ POSTGRES_PASSWORD manquante!${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ DATABASE_URL est définie${NC}"
fi

# 2. Tester la connexion PostgreSQL
echo -e "\n${YELLOW}[2/6] Connexion PostgreSQL${NC}"
PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" > /dev/null 2>&1
test_step $? "Connexion à PostgreSQL"

if [ $? -ne 0 ]; then
  echo -e "${RED}La base de données n'est pas accessible. Vérifiez que le service postgres est démarré.${NC}"
  exit 1
fi

# 3. Vérifier que les tables existent
echo -e "\n${YELLOW}[3/6] Vérification des tables${NC}"
TABLE_COUNT=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "Tables trouvées: $TABLE_COUNT"

if [ "$TABLE_COUNT" -lt 5 ]; then
  echo -e "${RED}✗ Migrations non appliquées ou incomplètes${NC}"
  echo "Exécution des migrations..."
  cd /app/apps/api
  npx prisma migrate deploy
else
  echo -e "${GREEN}✓ Tables existent${NC}"
fi

# 4. Vérifier l'utilisateur demo
echo -e "\n${YELLOW}[4/6] Vérification de l'utilisateur demo${NC}"
USER_EXISTS=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT EXISTS (SELECT 1 FROM users WHERE email = 'demo@o3c.dev');")

if [ "$USER_EXISTS" = "f" ]; then
  echo -e "${RED}✗ Utilisateur demo n'existe pas${NC}"
  echo "Exécution du seed..."
  cd /app/apps/api
  npx prisma db seed
  test_step $? "Seed de la base de données"
else
  echo -e "${GREEN}✓ Utilisateur demo existe${NC}"

  # Afficher les infos de l'utilisateur
  USER_INFO=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT email, \"isActive\", \"workspaceId\" FROM users WHERE email = 'demo@o3c.dev';")
  echo "Informations: $USER_INFO"
fi

# 5. Tester le hachage bcrypt
echo -e "\n${YELLOW}[5/6] Test de vérification du mot de passe${NC}"
PASSWORD_HASH=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT \"passwordHash\" FROM users WHERE email = 'demo@o3c.dev';")

if [ -n "$PASSWORD_HASH" ]; then
  echo -e "${GREEN}✓ Hash du mot de passe récupéré${NC}"
  echo "Hash (premiers 20 caractères): ${PASSWORD_HASH:0:20}..."

  # Tester avec Node.js et bcrypt
  cd /app/apps/api
  node -e "
    const bcrypt = require('bcrypt');
    const hash = '$PASSWORD_HASH';
    const password = 'password123';
    bcrypt.compare(password, hash).then(result => {
      if (result) {
        console.log('✓ Mot de passe correspond au hash');
        process.exit(0);
      } else {
        console.log('✗ Mot de passe ne correspond PAS au hash');
        process.exit(1);
      }
    }).catch(err => {
      console.error('Erreur bcrypt:', err);
      process.exit(1);
    });
  "
  test_step $? "Vérification bcrypt du mot de passe"
else
  echo -e "${RED}✗ Impossible de récupérer le hash du mot de passe${NC}"
fi

# 6. Tester l'endpoint de login
echo -e "\n${YELLOW}[6/6] Test de l'endpoint login${NC}"
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@o3c.dev", "password": "password123"}' \
  --max-time 10)

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✓ Login réussi!${NC}"
  echo "Response body:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" = "504" ]; then
  echo -e "${RED}✗ Timeout 504 - La requête prend trop de temps${NC}"
  echo "Causes possibles:"
  echo "  - bcrypt trop lent (coût trop élevé)"
  echo "  - Connexion DB lente"
  echo "  - Problème de proxy/timeout Coolify"
else
  echo -e "${RED}✗ Login échoué avec code $HTTP_CODE${NC}"
  echo "Response:"
  echo "$BODY"
fi

echo -e "\n${GREEN}========================================"
echo "Diagnostic terminé"
echo "========================================${NC}"
