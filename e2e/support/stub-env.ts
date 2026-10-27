import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * The configuration the stubs need, printed as `.env` lines.
 *
 * `node --experimental-strip-types e2e/support/stub-env.ts >> .env`, before the
 * API is started: the API reads where the stubs are at boot, so a test cannot
 * arrange it.
 *
 * The keys are generated here (`scripts/stack/stack.mjs` keeps them per
 * `.stack/`), so a real key can never be what makes the suite pass.
 */
const GITHUB_STUB = process.env.GITHUB_STUB_URL ?? 'http://127.0.0.1:4319';
const NAMER_STUB = process.env.NAMER_STUB_URL ?? 'http://127.0.0.1:4320';
const CURSOR_STUB = process.env.CURSOR_STUB_URL ?? 'http://127.0.0.1:4321';
/** The App's slug, shared with the specs that assert on the install URL. */
const { slug: GITHUB_APP_SLUG } = JSON.parse(
  readFileSync(new URL('./github-app.json', import.meta.url), 'utf8'),
) as { slug: string };

/** The App JWT is RS256, so the App's key is RSA. */
function githubAppKey(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return privateKey
    .export({ format: 'pem', type: 'pkcs8' })
    .toString()
    .trim()
    .replace(/\n/g, '\\n');
}

/**
 * The control plane signs a runner's boot assertion with Ed25519, and the
 * `hosts` capability is off until it has a key to derive a fingerprint from —
 * which is what makes pairing, and therefore every session, testable at all.
 */
function controlPlaneKey(): string {
  const { privateKey } = generateKeyPairSync('ed25519');
  return privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
}

const lines = [
  '',
  '# --- Added by e2e/support/stub-env.ts. Generated per run; never a real key. ---',
  '',
  '# A GitHub App that does not exist, pointed at the stub that answers for it.',
  'GITHUB_APP_ID=123456',
  `GITHUB_APP_PRIVATE_KEY=${githubAppKey()}`,
  'GITHUB_APP_WEBHOOK_SECRET=stub-webhook-secret',
  'GITHUB_APP_CLIENT_ID=Iv1.stubclientid',
  'GITHUB_APP_CLIENT_SECRET=stub-client-secret',
  `GITHUB_APP_SLUG=${GITHUB_APP_SLUG}`,
  `GITHUB_APP_API_URL=${GITHUB_STUB}`,
  `GITHUB_APP_OAUTH_URL=${GITHUB_STUB}`,
  '# Seals the stub user token the install exchange hands over.',
  `GITHUB_USER_TOKEN_KEY=${randomBytes(32).toString('base64')}`,
  "# Seals the workspaces' model provider keys, so bots can be given one.",
  `BOTS_PROVIDER_KEY=${randomBytes(32).toString('base64')}`,
  '',
  '# Enough for the hosts capability: a signing key and somewhere to point an',
  '# install command. No runner ever fetches these URLs in this suite.',
  `CONTROL_PLANE_SIGNING_KEY=${controlPlaneKey()}`,
  `RUNNER_RELEASE_BASE_URL=${GITHUB_STUB}/releases`,
  `RUNNER_INSTALL_URL=${GITHUB_STUB}/install.sh`,
  '',
  '# The namer, so a session named from its first prompt is covered rather than',
  '# assumed. The stub answers a title derived from the prompt it was given.',
  'LLM_PROVIDER=openai-compatible',
  'LLM_MODEL=a-stub-model',
  `LLM_BASE_URL=${NAMER_STUB}/v1`,
  '',
  "# The deployment's speech-to-text server, for dictation: the same stub, which",
  '# hears one fixed sentence in every clip (`STUB_TRANSCRIPT`).',
  `VOICE_STT_BASE_URL=${NAMER_STUB}/v1`,
  'VOICE_STT_MODEL=a-stub-transcriber',
  '',
  "# Cloud agents, on a stand-in for Cursor's Cloud Agents API that takes any",
  '# key starting `crsr_stub_` and plays each run out on its own clock.',
  `CLOUD_AGENTS_KEY=${randomBytes(32).toString('base64')}`,
  `CLOUD_AGENTS_CURSOR_API_URL=${CURSOR_STUB}`,
  '',
].join('\n');

process.stdout.write(lines);
