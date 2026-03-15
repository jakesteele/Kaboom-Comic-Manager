# Stage 1: Install deps and build frontend
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY web/package.json web/
COPY server/package.json server/
RUN pnpm install --frozen-lockfile
COPY shared/ shared/
COPY web/ web/
COPY server/ server/
ENV API_BASE=""
RUN pnpm --filter @opds/web build

# Stage 2: Production
FROM node:20-alpine
RUN apk add --no-cache vips-dev
WORKDIR /app

# Copy workspace deps (includes tsx for running TypeScript)
COPY --from=build /app/node_modules ./node_modules/
COPY --from=build /app/server/node_modules ./server/node_modules/
COPY --from=build /app/shared ./shared/

# Copy server source (tsx runs TypeScript directly, no build step needed)
COPY --from=build /app/server/src ./server/src/
COPY --from=build /app/server/package.json ./server/

# Copy built frontend
COPY --from=build /app/web/.output/public ./web-output/

VOLUME /data
ENV DATA_DIR=/data
ENV WEB_DIR=/app/web-output
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "server/src/index.ts"]
