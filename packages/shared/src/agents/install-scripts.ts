/**
 * A package from the npm registry, installed under `~/.local` so the global
 * prefix is the person's own and `npm` needs no root. npm checks the tarball
 * against the registry's integrity hash before it unpacks it, and a package
 * with platform binaries (`opencode-ai`) gets them the same way, as its
 * optional dependencies. Node is a prerequisite the script names rather than
 * installs.
 */
export function npmUserInstall(pkg: string): string {
  return [
    'set -eu',
    'command -v npm >/dev/null 2>&1 || { echo "npm is not on PATH; install Node.js 22 first" >&2; exit 1; }',
    `npm install --global --prefix "$HOME/.local" ${pkg}`,
  ].join('\n');
}

/**
 * A package from the npm registry, installed with Bun into Bun's own global
 * directory (`~/.bun/bin`), which is the person's and needs no root. For a CLI
 * whose executable is a Bun script (`#!/usr/bin/env bun`), so npm could
 * install it but nothing could run it without Bun. Bun checks each tarball
 * against the registry's integrity hash, as npm does. Bun is a prerequisite
 * the script names rather than installs.
 */
export function bunUserInstall(pkg: string): string {
  return [
    'set -eu',
    'command -v bun >/dev/null 2>&1 || { echo "bun is not on PATH; install Bun first (bun.sh)" >&2; exit 1; }',
    `bun install --global ${pkg}`,
  ].join('\n');
}
