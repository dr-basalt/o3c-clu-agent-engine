# ========================================
# API Dockerfile
# ========================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.14.0

# Copy package files
COPY package.json tsconfig.json turbo.json ./
COPY pnpm-workspace.yaml* ./
COPY pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies (generate lockfile if not present)
RUN pnpm install --no-frozen-lockfile

# Generate Prisma client
RUN cd apps/api && pnpm prisma generate

# Build API (NestJS will compile all TypeScript including shared packages)
RUN pnpm --filter @o3c/api build

# ========================================
# Production image
# ========================================
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.14.0

# Install rowboatx
RUN npm install -g @rowboatlabs/rowboatx@latest

# Copy package files
COPY package.json ./
COPY pnpm-workspace.yaml* ./
COPY pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/

# Install production dependencies only (use lockfile from builder)
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --prod --frozen-lockfile

# Copy built application (NestJS bundles everything in dist)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy package source for runtime (shared packages might be needed)
COPY --from=builder /app/packages ./packages

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN mkdir -p /data/workspaces && chown -R nodejs:nodejs /data

USER nodejs

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
