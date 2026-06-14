# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests first for better Docker layer caching
COPY package.json package-lock.json ./

# Install ALL dependencies (dev + prod) needed for the build
RUN npm ci

# Copy source code
COPY . .

# Build the frontend (output: frontend/dist/) and bundle the server
# The build script: vite build frontend && esbuild server.ts → dist/server.cjs
RUN npm run build

# ─── Stage 2: Production runtime ─────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

# Copy only production dependency manifests
COPY package.json package-lock.json ./

# Install production-only packages (no dev tools)
RUN npm ci --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend source that gets imported at runtime
# (models + mongoose connection — not bundled by esbuild --packages=external)
COPY --from=builder /app/backend ./backend

# Hugging Face Spaces exposes port 7860
EXPOSE 7860

# Environment defaults (override via HF Spaces Secrets)
ENV PORT=7860
ENV NODE_ENV=production

# Run the compiled server bundle
CMD ["node", "dist/server.cjs"]
