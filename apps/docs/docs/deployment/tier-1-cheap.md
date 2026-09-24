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

```bash
# On the VPS
docker compose -f docker/docker-compose.prod.yml up -d
```

### 3. Deploy Web

Connect your repo to Vercel or Cloudflare Pages. Set the root directory to `apps/web`.

### 4. Deploy Docs

Connect your repo to Cloudflare Pages. Set the root directory to `apps/docs`.
