#!/usr/bin/env node
/**
 * `docker compose` on docker/docker-compose.monitoring.yml, with the
 * environment the API itself runs with. The package scripts start Node with
 * `--env-file-if-exists=.env --env-file-if-exists=.env.local`, which loads the
 * two files in the order and with the precedence `@oppenheimer/env` gives them
 * (`.env.local` over `.env`, a real environment variable over both), so
 * Compose reads the same METRICS_TOKEN and PORT the API does.
 *
 *   pnpm monitoring:up     # → docker compose … up -d
 *   pnpm monitoring:down   # → docker compose … down
 */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = join(ROOT, 'docker', 'docker-compose.monitoring.yml');
const result = spawnSync('docker', ['compose', '-f', file, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
