# ========================================
# API Dockerfile
# ========================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.14.0

# Copy package files
COPY package.json turbo.json ./
COPY pnpm-workspace.yaml* ./
COPY pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies (generate lockfile if not present)
RUN pnpm install --no-frozen-lockfile

# Generate Prisma client
RUN cd apps/api && pnpm prisma generate

# Build shared packages first
RUN pnpm --filter @o3c/shared-types build
RUN pnpm --filter @o3c/shared-config build

# Build API
RUN pnpm --filter @o3c/api build

# ========================================
# Production image
# ========================================
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.14.0

# Install rowboatx
RUN npm install -g rowboatx

# Copy package files
COPY package.json ./
COPY pnpm-workspace.yaml* ./
COPY pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/

# Install production dependencies only (use lockfile from builder)
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-config/dist ./packages/shared-config/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN mkdir -p /data/workspaces && chown -R nodejs:nodejs /data

USER nodejs

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
