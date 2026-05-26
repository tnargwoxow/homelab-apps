# Wedding Wordle — single-image Node server (API + static frontend)
FROM node:20-bookworm-slim

# better-sqlite3 ships a prebuilt binary for this platform, but keep the
# toolchain available so `npm ci` can compile from source if needed.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Install backend deps first for better layer caching.
COPY backend/package.json ./backend/package.json
RUN cd backend && npm install --omit=dev

# App code.
COPY backend ./backend
COPY public ./public

ENV PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data

EXPOSE 3000
VOLUME ["/app/data"]

WORKDIR /app/backend
CMD ["node", "server.js"]
