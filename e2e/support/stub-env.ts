import { generateKeyPairSync } from 'node:crypto';

/**
 * The configuration the two stubs need, printed as `.env` lines.
 *
 * `node --experimental-strip-types e2e/support/stub-env.ts >> .env`, before the
 * API is started. It exists because the suite's two stand-ins are only useful
 * if the API is *pointed at them*, and the API reads that at boot — so this is
 * part of standing the stack up rather than something a test can arrange.
 *
 * The keys are generated per run and thrown away with the job. They are
 * credentials for a GitHub App that does not exist and a control plane no
 * runner will ever dial, so there is nothing here worth committing — and
 * generating them is what keeps a real key from ever being the thing that makes
 * the suite pass.
 */
const GITHUB_STUB = process.env.GITHUB_STUB_URL ?? 'http://127.0.0.1:4319';
const NAMER_STUB = process.env.NAMER_STUB_URL ?? 'http://127.0.0.1:4320';

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
  'GITHUB_APP_SLUG=oppenheimer-stub',
  `GITHUB_API_URL=${GITHUB_STUB}`,
  `GITHUB_OAUTH_URL=${GITHUB_STUB}`,
  '',
  '# Enough for the hosts capability: a signing key and somewhere to point an',
  '# install command. No runner ever fetches these URLs in this suite.',
  `CONTROL_PLANE_SIGNING_KEY=${controlPlaneKey()}`,
  `RUNNER_RELEASE_BASE_URL=${GITHUB_STUB}/releases`,
  `RUNNER_INSTALL_URL=${GITHUB_STUB}/install.sh`,
  '',
  '# The namer, so a session named from its first prompt is covered rather than',
  '# assumed. The stub answers a title derived from the prompt it was given.',
  'SESSION_NAMER_PROVIDER=openai-compatible',
  'SESSION_NAMER_MODEL=a-stub-model',
  `SESSION_NAMER_BASE_URL=${NAMER_STUB}/v1`,
  '',
].join('\n');

process.stdout.write(lines);
