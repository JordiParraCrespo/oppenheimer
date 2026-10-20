/**
 * The shell the catalogs' release installs share: a tool's latest release,
 * downloaded over HTTPS and checked against the checksum its vendor publishes
 * for that release before anything from it is unpacked or run.
 *
 * Each tool's script still finds its own latest version and reads its own
 * checksum format (GitHub's `checksums.txt` for gh, the JSON manifest for
 * Claude Code); what they share is the scratch directory and the one check
 * that decides, which fails closed: a checksum that is missing, malformed or
 * different stops the script before the download is used.
 *
 * The trust is the vendor's release over HTTPS: this catches a download that
 * was cut short, corrupted, or swapped on a mirror or CDN, not a vendor whose
 * own release is compromised (`product/versions/mvp/02-runner.md` §10).
 *
 * Private to the agents directory: the catalogs only spell data with it.
 */

export type ReleasePlatform = 'macos' | 'linux';

/** A scratch directory, removed however the script ends. */
export const RELEASE_TEMP_DIR: readonly string[] = Object.freeze([
  'tmp="$(mktemp -d)"',
  'trap \'rm -rf "$tmp"\' EXIT',
]);

/**
 * Defines `verify FILE SHA256` for the script: it exits the script unless
 * FILE hashes to SHA256, which must be 64 lowercase hex characters — so a
 * checksum the script could not read never passes. `sha256sum` on Linux,
 * `shasum -a 256` on macOS, which is what each ships.
 */
export function sha256Verifier(platform: ReleasePlatform, tool: string): readonly string[] {
  const hash = platform === 'macos' ? 'shasum -a 256' : 'sha256sum';
  return [
    'verify() {',
    `  printf '%s' "$2" | grep -Eqx '[0-9a-f]{64}' || { echo "${tool}: no published checksum for $1" >&2; exit 1; }`,
    `  actual="$(${hash} "$1" | cut -d ' ' -f 1)"`,
    `  [ "$actual" = "$2" ] || { echo "${tool}: checksum mismatch for $1" >&2; exit 1; }`,
    '}',
  ];
}
