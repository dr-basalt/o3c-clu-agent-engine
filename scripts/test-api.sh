#!/bin/bash

# ========================================
# Script de Test de l'API O3C-CLU-AGENT-ENGINE
# ========================================

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
API_V1="${API_URL}/api/v1"
TEST_EMAIL="demo@o3c.dev"
TEST_PASSWORD="password123"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test de l'API O3C-CLU-AGENT-ENGINE${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Fonction pour afficher les résultats
print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ $2${NC}"
  else
    echo -e "${RED}✗ $2${NC}"
  fi
}

# Fonction pour tester un endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local description=$3
  local headers=$4
  local data=$5

  echo -e "\n${YELLOW}Test: ${description}${NC}"
  echo -e "Endpoint: ${method} ${endpoint}"

  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "${method}" "${endpoint}" ${headers} -d "${data}")
  else
    response=$(curl -s -w "\n%{http_code}" -X "${method}" "${endpoint}" ${headers})
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  echo -e "Status: ${http_code}"
  echo -e "Response:\n${body}" | jq '.' 2>/dev/null || echo "${body}"

  if [ "${http_code:0:1}" = "2" ]; then
    print_result 0 "$description"
    return 0
  else
    print_result 1 "$description"
    return 1
  fi
}

# 1. Health Check
echo -e "\n${BLUE}[1/8] Health Check${NC}"
test_endpoint "GET" "${API_V1}/health" "Vérification de santé de l'API" ""

# 2. Login
echo -e "\n${BLUE}[2/8] Authentication - Login${NC}"
login_response=$(curl -s -X POST "${API_V1}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${TEST_EMAIL}\", \"password\": \"${TEST_PASSWORD}\"}")

access_token=$(echo "$login_response" | jq -r '.accessToken')

if [ "$access_token" != "null" ] && [ -n "$access_token" ]; then
  print_result 0 "Login réussi"
  echo -e "Access Token: ${access_token:0:20}..."
else
  print_result 1 "Login échoué"
  echo -e "${RED}Erreur: Impossible de se connecter. Assurez-vous que la base de données est seedée.${NC}"
  echo -e "${YELLOW}Exécutez: cd apps/api && pnpm prisma db seed${NC}"
  exit 1
fi

# 3. Get Current User
echo -e "\n${BLUE}[3/8] Get Current User${NC}"
me_response=$(curl -s -X GET "${API_V1}/auth/me" \
  -H "Authorization: Bearer ${access_token}")

user_id=$(echo "$me_response" | jq -r '.id')
echo -e "User Info:\n${me_response}" | jq '.'

if [ "$user_id" != "null" ]; then
  print_result 0 "Récupération de l'utilisateur courant"
else
  print_result 1 "Récupération de l'utilisateur courant"
  exit 1
fi

# 4. Create API Key
echo -e "\n${BLUE}[4/8] Create API Key${NC}"
api_key_response=$(curl -s -X POST "${API_V1}/auth/api-keys" \
  -H "Authorization: Bearer ${access_token}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test API Key from script"}')

api_key=$(echo "$api_key_response" | jq -r '.key')

if [ "$api_key" != "null" ] && [ -n "$api_key" ]; then
  print_result 0 "Création de l'API Key"
  echo -e "${GREEN}API Key: ${api_key}${NC}"
  echo -e "${YELLOW}Sauvegardez cette clé, elle ne sera plus visible!${NC}"
else
  print_result 1 "Création de l'API Key"
  echo -e "${RED}Utilisation de l'API Key existante...${NC}"
  # Fallback: récupérer l'API key de la BDD
  api_key=$(echo "$me_response" | jq -r '.apiKey')
fi

# 5. List Agents
echo -e "\n${BLUE}[5/8] List Agents${NC}"
agents_response=$(curl -s -X GET "${API_V1}/agents" \
  -H "X-API-Key: ${api_key}")

agent_count=$(echo "$agents_response" | jq -r '.data | length')
echo -e "Agents trouvés: ${agent_count}"
echo "$agents_response" | jq '.'

if [ "$agent_count" -ge 0 ]; then
  print_result 0 "Liste des agents récupérée"

  # Si un agent existe, récupérer son ID
  if [ "$agent_count" -gt 0 ]; then
    agent_id=$(echo "$agents_response" | jq -r '.data[0].id')
    echo -e "Premier agent ID: ${agent_id}"
  fi
else
  print_result 1 "Liste des agents"
fi

# 6. Create Agent (si aucun n'existe)
echo -e "\n${BLUE}[6/8] Create Agent${NC}"
if [ -z "$agent_id" ] || [ "$agent_id" = "null" ]; then
  agent_create_response=$(curl -s -X POST "${API_V1}/agents" \
    -H "X-API-Key: ${api_key}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test Agent from Script",
      "description": "Agent créé automatiquement par le script de test",
      "systemPrompt": "Tu es un assistant utile qui répond en français.",
      "mcpServers": [],
      "tools": ["shell"],
      "allowShell": true,
      "maxIterations": 10
    }')

  agent_id=$(echo "$agent_create_response" | jq -r '.id')

  if [ "$agent_id" != "null" ] && [ -n "$agent_id" ]; then
    print_result 0 "Création de l'agent"
    echo -e "Agent ID: ${agent_id}"
  else
    print_result 1 "Création de l'agent"
  fi
else
  echo -e "${YELLOW}Agent existant utilisé: ${agent_id}${NC}"
  print_result 0 "Utilisation d'un agent existant"
fi

# 7. Execute Agent
echo -e "\n${BLUE}[7/8] Execute Agent${NC}"
if [ -n "$agent_id" ] && [ "$agent_id" != "null" ]; then
  echo -e "${YELLOW}Exécution de l'agent... (cela peut prendre quelques secondes)${NC}"

  execution_response=$(curl -s -X POST "${API_V1}/agents/${agent_id}/execute" \
    -H "X-API-Key: ${api_key}" \
    -H "Content-Type: application/json" \
    -d '{
      "prompt": "Quelle est la date d'\''aujourd'\''hui ?",
      "runAsync": false
    }')

  execution_id=$(echo "$execution_response" | jq -r '.id')

  if [ "$execution_id" != "null" ] && [ -n "$execution_id" ]; then
    print_result 0 "Exécution de l'agent"
    echo -e "Execution ID: ${execution_id}"
    echo -e "Response:\n${execution_response}" | jq '.'
  else
    print_result 1 "Exécution de l'agent"
    echo -e "Response:\n${execution_response}" | jq '.'
  fi
else
  echo -e "${YELLOW}Aucun agent disponible pour l'exécution${NC}"
  print_result 1 "Exécution de l'agent (agent manquant)"
fi

# 8. Download OpenAPI JSON
echo -e "\n${BLUE}[8/8] Download OpenAPI JSON${NC}"
openapi_response=$(curl -s "${API_URL}/api/docs-json")

if echo "$openapi_response" | jq -e '.openapi' > /dev/null 2>&1; then
  print_result 0 "Téléchargement du fichier OpenAPI"
  echo "$openapi_response" > openapi.json
  echo -e "${GREEN}Fichier OpenAPI sauvegardé: openapi.json${NC}"
  echo -e "Titre: $(echo "$openapi_response" | jq -r '.info.title')"
  echo -e "Version: $(echo "$openapi_response" | jq -r '.info.version')"
else
  print_result 1 "Téléchargement du fichier OpenAPI"
fi

# Résumé
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Résumé des Tests${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${GREEN}Credentials pour Flowise:${NC}"
echo -e "  API Base URL: ${API_URL}"
echo -e "  API Key: ${api_key}"
echo -e "  Agent ID: ${agent_id}"
echo -e "  OpenAPI File: ./openapi.json"

echo -e "\n${YELLOW}Exemple d'utilisation avec curl:${NC}"
echo -e "curl -X POST ${API_V1}/agents/${agent_id}/execute \\"
echo -e "  -H 'X-API-Key: ${api_key}' \\"
echo -e "  -H 'Content-Type: application/json' \\"
echo -e "  -d '{\"prompt\": \"Bonjour\", \"runAsync\": false}'"

echo -e "\n${YELLOW}Exemple d'utilisation avec l'API OpenAI:${NC}"
echo -e "curl -X POST ${API_URL}/v1/chat/completions \\"
echo -e "  -H 'X-API-Key: ${api_key}' \\"
echo -e "  -H 'Content-Type: application/json' \\"
echo -e "  -d '{\"model\": \"agent:${agent_id}\", \"messages\": [{\"role\": \"user\", \"content\": \"Bonjour\"}]}'"

echo -e "\n${GREEN}✓ Tests terminés!${NC}\n"
