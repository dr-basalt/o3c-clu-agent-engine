#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  O3C-CLU-AGENT-ENGINE DEV SETUP        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check requirements
echo -e "${YELLOW}[1/6] Checking requirements...${NC}"
command -v node >/dev/null 2>&1 || { echo "Error: node not installed"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm not installed"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Error: docker not installed"; exit 1; }
echo -e "${GREEN}✓ Requirements met${NC}"
echo ""

# Start database services
echo -e "${YELLOW}[2/6] Starting PostgreSQL and Redis...${NC}"
docker-compose up -d
sleep 5
echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}[3/6] Installing dependencies...${NC}"
pnpm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Setup environment
echo -e "${YELLOW}[4/6] Setting up environment...${NC}"
if [ ! -f apps/api/.env ]; then
    cp apps/api/.env.example apps/api/.env
    echo -e "${GREEN}✓ Created apps/api/.env${NC}"
else
    echo -e "${GREEN}✓ apps/api/.env already exists${NC}"
fi
echo ""

# Generate Prisma client and run migrations
echo -e "${YELLOW}[5/6] Running database migrations...${NC}"
cd apps/api
pnpm prisma generate
pnpm prisma migrate dev --name init
echo -e "${GREEN}✓ Migrations complete${NC}"
echo ""

# Seed database
echo -e "${YELLOW}[6/6] Seeding database...${NC}"
pnpm prisma db seed
cd ../..
echo -e "${GREEN}✓ Database seeded${NC}"
echo ""

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      SETUP COMPLETE! 🎉                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo -e "  1. Start development: ${YELLOW}pnpm dev${NC}"
echo -e "  2. API will run on: ${YELLOW}http://localhost:3000${NC}"
echo -e "  3. Swagger docs: ${YELLOW}http://localhost:3000/api/docs${NC}"
echo ""
echo -e "${GREEN}Test credentials (from seed):${NC}"
echo -e "  Email: ${YELLOW}demo@o3c.dev${NC}"
echo -e "  Password: ${YELLOW}password123${NC}"
echo ""
