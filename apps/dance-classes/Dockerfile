# syntax=docker/dockerfile:1.7

# ---------- frontend build ----------
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- backend build ----------
FROM node:20-alpine AS backend
WORKDIR /app/backend
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm install --no-audit --no-fund
COPY backend/ ./
RUN npm run build
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM node:20-alpine
RUN apk add --no-cache ffmpeg tini wget
WORKDIR /app
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist          ./dist
COPY --from=backend /app/backend/src/db/migrations ./dist/db/migrations
COPY --from=backend /app/backend/package.json  ./package.json
COPY --from=frontend /app/frontend/dist        ./public

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    VIDEOS_DIR=/videos \
    DATA_DIR=/data \
    PUBLIC_DIR=/app/public

EXPOSE 8080
VOLUME ["/videos", "/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
