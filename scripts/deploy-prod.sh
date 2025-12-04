#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   O3C-CLU-AGENT-ENGINE DEPLOYMENT      ║${NC}"
echo -e "${GREEN}║         Production Edition             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check requirements
echo -e "${YELLOW}[1/7] Checking requirements...${NC}"
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Error: docker not installed${NC}"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}Error: docker-compose not installed${NC}"; exit 1; }
echo -e "${GREEN}✓ Requirements met${NC}"
echo ""

# Check .env file
echo -e "${YELLOW}[2/7] Checking environment configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Validate required variables
REQUIRED_VARS=(
    "POSTGRES_PASSWORD"
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
    "ENCRYPTION_KEY"
    "API_DOMAIN"
)

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=$" .env; then
        echo -e "${RED}Error: ${var} not configured in .env${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# Build Docker image
echo -e "${YELLOW}[3/7] Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build
echo -e "${GREEN}✓ Images built${NC}"
echo ""

# Create networks
echo -e "${YELLOW}[4/7] Creating Docker networks...${NC}"
docker network inspect o3c-network >/dev/null 2>&1 || docker network create o3c-network
echo -e "${GREEN}✓ Networks created${NC}"
echo ""

# Stop existing containers
echo -e "${YELLOW}[5/7] Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup done${NC}"
echo ""

# Start services
echo -e "${YELLOW}[6/7] Starting production services...${NC}"
docker-compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Wait for health checks
echo -e "${YELLOW}[7/7] Waiting for services to be healthy...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    HEALTHY=$(docker-compose -f docker-compose.prod.yml ps | grep -c "(healthy)" || true)
    TOTAL=$(docker-compose -f docker-compose.prod.yml ps | grep -c "Up" || true)

    echo -ne "  Health: ${HEALTHY}/${TOTAL} services healthy...\r"

    if [ "$HEALTHY" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
        echo -e "\n${GREEN}✓ All services healthy${NC}"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    sleep 10
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "\n${YELLOW}Warning: Some services may not be healthy${NC}"
    echo "Check logs with: docker-compose -f docker-compose.prod.yml logs"
fi
echo ""

# Display results
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     DEPLOYMENT SUCCESSFUL! 🎉          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
API_DOMAIN=$(grep "^API_DOMAIN=" .env | cut -d '=' -f2)
echo -e "${GREEN}Services:${NC}"
echo -e "  • API:  https://${API_DOMAIN}"
echo -e "  • Docs: https://${API_DOMAIN}/api/docs"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo -e "  • View logs:     docker-compose -f docker-compose.prod.yml logs -f"
echo -e "  • Stop:          docker-compose -f docker-compose.prod.yml down"
echo -e "  • Restart:       docker-compose -f docker-compose.prod.yml restart"
echo ""
