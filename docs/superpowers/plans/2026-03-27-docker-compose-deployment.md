# Docker Compose Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the Next.js classroom attendance app for server deployment using a production Docker image and a single-service Docker Compose setup behind an existing reverse proxy.

**Architecture:** Enable Next.js standalone output, build a multi-stage Node 20 production image, and run it through `docker compose` with environment variables supplied from a server-side env file. Keep Supabase external and bind the app only to `127.0.0.1:3000` so the existing reverse proxy remains the public entry point.

**Tech Stack:** Next.js 15, Node.js 20, Docker, Docker Compose, npm

---

## File Structure

- `next.config.ts`
  - Enable standalone server output for lean production images.
- `.gitignore`
  - Ignore Docker-related env files and macOS metadata junk.
- `.dockerignore`
  - Keep build context small by excluding caches, Git data, local env files, and AppleDouble files.
- `Dockerfile`
  - Build and run the production image with separate dependency, builder, and runner stages.
- `docker-compose.yml`
  - Define the single production service, local-only port binding, restart policy, build args, and runtime env loading.
- `.env.production.example`
  - Document the exact server-side environment variables required for build and runtime.
- `README.md`
  - Add the Docker deployment workflow and reverse proxy guidance.

## Task 0: Start from an isolated feature branch in the current workspace

**Files:**
- Verify only

- [ ] **Step 1: Create a non-main feature branch before implementation**

Run: `git switch -c codex/docker-compose-deployment`
Expected: Current branch becomes `codex/docker-compose-deployment`.

- [ ] **Step 2: Confirm the branch switch worked**

Run: `git branch --show-current`
Expected: Output is exactly `codex/docker-compose-deployment`.

## Task 1: Prepare Next.js output and ignore rules

**Files:**
- Modify: `next.config.ts`
- Modify: `.gitignore`
- Create: `.dockerignore`

- [ ] **Step 1: Capture the current production build baseline**

Run: `npm run build`
Expected: Build completes successfully before Docker-specific changes.

- [ ] **Step 2: Enable standalone output in Next.js**

Update `next.config.ts` so the config includes:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  webpack: (config, { isServer }) => {
    if (isServer && config.output) {
      config.output.chunkFilename = "chunks/[name].js";
    }

    return config;
  },
};
```

- [ ] **Step 3: Expand git ignore rules for deployment artifacts**

Append these lines to `.gitignore`:

```gitignore
.env.production
.DS_Store
._*
```

- [ ] **Step 4: Create the Docker build context ignore file**

Create `.dockerignore` with:

```gitignore
.git
.gitignore
.next
node_modules
npm-debug.log*
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.production
.DS_Store
._*
docs
```

- [ ] **Step 5: Re-run the production build after config changes**

Run: `npm run build`
Expected: Build still succeeds and `.next/standalone` is generated.

## Task 2: Add the production Docker image

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Write the multi-stage Dockerfile**

Create `Dockerfile` with:

```dockerfile
FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Validate the Dockerfile syntax through a plain build**

Run:

```bash
set -a
source .env.local
set +a
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY" \
  -t classroom-attendance:local .
```

Expected: Docker image builds successfully with no missing file errors.

## Task 3: Define Compose service and production env template

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.production.example`

- [ ] **Step 1: Create the production env template**

Create `.env.production.example` with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-service-role-or-secret-key
ADMIN_PASSWORD=change-this-password
```

- [ ] **Step 2: Create the Compose file**

Create `docker-compose.yml` with:

```yaml
services:
  attendance-web:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY}
    environment:
      NODE_ENV: production
      PORT: 3000
      HOSTNAME: 0.0.0.0
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY}
      SUPABASE_SECRET_KEY: ${SUPABASE_SECRET_KEY:-}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:-}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
    ports:
      - "127.0.0.1:3000:3000"
    restart: unless-stopped
```

- [ ] **Step 3: Validate Compose interpolation and shape**

Run: `docker compose --env-file .env.local config`
Expected: Compose renders one valid `attendance-web` service with resolved build args and env file.

## Task 4: Update deployment documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Docker deployment prerequisites**

Document:

- Docker Engine and Docker Compose plugin are installed on the server
- `.env.production` must be created from `.env.production.example`
- Supabase stays external

- [ ] **Step 2: Add server deployment commands**

Add a deployment section with these commands:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose --env-file .env.production logs -f
```

- [ ] **Step 3: Add reverse proxy guidance**

Document that the reverse proxy should forward the domain to `127.0.0.1:3000` and preserve:

- `Host`
- `X-Forwarded-For`
- `X-Forwarded-Proto`

- [ ] **Step 4: Add update and rollback-adjacent operational notes**

Document:

- Updating means re-running `docker compose --env-file .env.production build` and `docker compose --env-file .env.production up -d`
- Environment variable changes require rebuild and restart
- Logs are inspected with `docker compose --env-file .env.production logs -f`

## Task 5: Run end-to-end verification

**Files:**
- Verify only

- [ ] **Step 1: Re-run the local Next.js production build**

Run: `npm run build`
Expected: Exit code `0`.

- [ ] **Step 2: Validate Compose file with the local env file**

Run: `docker compose --env-file .env.local config`
Expected: Exit code `0` and resolved service output.

- [ ] **Step 3: Build the final Compose image**

Run: `docker compose --env-file .env.local build`
Expected: Exit code `0` and image build completes.

- [ ] **Step 4: Start the service locally through Compose**

Run: `docker compose --env-file .env.local up -d`
Expected: Container starts successfully.

- [ ] **Step 5: Confirm the app answers on the bound port**

Run: `curl -I http://127.0.0.1:3000`
Expected: HTTP response headers are returned.

- [ ] **Step 6: Stop the local container after verification**

Run: `docker compose --env-file .env.local down`
Expected: Compose removes the running container cleanly.

- [ ] **Step 7: Commit the deployment work**

Run:

```bash
git add next.config.ts .gitignore .dockerignore Dockerfile docker-compose.yml .env.production.example README.md
git commit -m "feat: add docker compose deployment"
```

Expected: A feature branch contains the full Docker deployment change set.
