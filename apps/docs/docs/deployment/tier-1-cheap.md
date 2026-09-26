---
sidebar_position: 1
---

# Tier 1: Low-Cost Deployment (~€4/mo)

For personal projects and MVPs.

## Architecture

| App              | Where                                 | Cost   |
| ---------------- | ------------------------------------- | ------ |
| Web              | Vercel / Cloudflare Pages (free tier) | €0     |
| API + DB + Redis | Hetzner CX22 VPS                      | ~€4/mo |
| Docs             | Cloudflare Pages / GitHub Pages       | €0     |

## Setup

### 1. Provision a Hetzner VPS

Create a CX22 (2 vCPU, 4GB RAM) on Hetzner Cloud.

### 2. Deploy API with Docker Compose

The stack reads its settings from one `.env` at the root of the checkout, the
same file development uses. Its variables are documented in the root
`.env.example`.

```bash
# On the VPS, from the root of the checkout
cp .env.example .env
# Edit .env. At minimum: BETTER_AUTH_SECRET, BETTER_AUTH_URL and FRONTEND_URL
# (the public URLs), DB_PASSWORD, and the *_IMAGE tags CI pushed.
pnpm docker:prod        # docker compose --env-file .env -f docker/docker-compose.prod.yml up -d
```

Without `pnpm`, run the command in the comment. Keep the `--env-file .env`:
Compose otherwise looks for a `.env` beside the compose file, in `docker/`,
and the image, database and runner values interpolate blank. The `api` service
loads the whole file as its environment, so an optional feature (host pairing,
the GitHub App, email delivery, OAuth) turns on by setting its variables there
and restarting. `DB_HOST` and `REDIS_HOST` in `.env` are ignored inside the
stack: the compose file points the API at its own `postgres` and `redis`
services.

`pnpm docker:prod:down` stops the stack and keeps its volumes.

### 3. Deploy Web

Connect your repo to Vercel or Cloudflare Pages. Set the root directory to `apps/web`.

### 4. Deploy Docs

Connect your repo to Cloudflare Pages. Set the root directory to `apps/docs`.
