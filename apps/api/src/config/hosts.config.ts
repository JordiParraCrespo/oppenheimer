import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * What this deployment needs in order to pair a machine with it.
 *
 * **Optional capability**, all of it: a deployment with no runner release to
 * point at cannot hand a machine an install command, so the host routes answer
 * a "not configured" problem and nothing else changes (`hosts` in
 * `capabilities.module.ts`). Required settings fail boot instead — see
 * `.agents/rules/api-config.md` for which is which.
 *
 * `controlPlaneUrl` is the exception: it always has a value, because the runner
 * signs its boot assertion with this origin as the JWT audience
 * (`product/versions/mvp/01-protocol.md`) and a verifier with nothing to
 * compare against would accept a token minted for someone else. It defaults to
 * the API's own public URL, which is what a runner dials, and
 * `CONTROL_PLANE_URL` overrides it for a deployment whose runners reach the API
 * on a different name than its browsers do.
 */
const schema = z
  .object({
    controlPlaneUrl: z.string().url().optional(),
    apiPublicUrl: z.string().url().default('http://localhost:3001'),
    /**
     * The control plane's own Ed25519 private key, as the base64 of its PKCS#8
     * DER — one line, no PEM header:
     * `openssl genpkey -algorithm ed25519 -outform DER | base64 -w0`.
     * Only its public fingerprint leaves the process: a runner pins it at
     * registration (F6) and refuses to speak to anything else afterwards.
     */
    signingKey: z.string().optional(),
    releaseBaseUrl: z.string().url().optional(),
    releaseChannel: z.enum(['stable', 'beta']).default('stable'),
    installUrl: z.string().url().optional(),
  })
  .transform(({ apiPublicUrl, controlPlaneUrl, ...rest }) => ({
    // Trailing slashes are stripped on both sides of the audience comparison,
    // so `https://api.example.com/` and `https://api.example.com` are the same
    // control plane rather than two.
    controlPlaneUrl: (controlPlaneUrl ?? apiPublicUrl).replace(/\/+$/, ''),
    ...rest,
  }));

export const hostsConfig = registerAs('hosts', () =>
  parseEnv('hosts', schema, {
    controlPlaneUrl: 'CONTROL_PLANE_URL',
    apiPublicUrl: 'BETTER_AUTH_URL',
    signingKey: 'CONTROL_PLANE_SIGNING_KEY',
    releaseBaseUrl: 'RUNNER_RELEASE_BASE_URL',
    releaseChannel: 'RUNNER_RELEASE_CHANNEL',
    installUrl: 'RUNNER_INSTALL_URL',
  }),
);
