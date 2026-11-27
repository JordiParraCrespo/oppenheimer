import { createHash, randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EmailService } from '@oppenheimer/backend-email';
import { DataSource } from 'typeorm';
import { useTestDatabase, useTestRedis } from '../../__tests__/integration-services';
import type { SessionCachePort } from '../application/session-cache.port';
import { SESSION_CACHE } from '../auth.di-tokens';

/*
 * The application booted the way `main.ts` serves it, and the flows a person
 * and an OAuth client go through on it, for the integration specs that follow
 * a credential from its issue to its take-back: the API tokens', the OAuth
 * grants' and the administrator's set-password.
 */

export interface CredentialApi {
  app: INestApplication;
  baseUrl: string;
  dataSource: DataSource;
}

/** Boot the whole application on its own database and Redis db, listening on a free port. */
export async function startCredentialApi(): Promise<CredentialApi> {
  await useTestDatabase();
  await useTestRedis();

  process.env.BETTER_AUTH_SECRET = 'integration-test-secret-value-32-chars';

  // The address gate (`TOKEN_010`) holds only where the deployment delivers
  // email, so these suites run on one that does. The transport is never
  // reached: `EmailService` is replaced below.
  process.env.EMAIL_PROVIDER = 'nodemailer';
  process.env.SMTP_HOST = '127.0.0.1';

  // Import AppModule (and the Better Auth instance, which reads the database
  // config at module load) only after the env vars are set.
  const { AppModule } = await import('../../app.module');
  // Rate limiting is skipped under NODE_ENV=test (see AppModule): a suite
  // that mints dozens of tokens would otherwise trip the deliberately low
  // limit on token creation.
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EmailService)
    .useValue(deliveredNowhere())
    .compile();

  const app = moduleRef.createNestApplication({ bodyParser: false });

  // Mirror `main.ts`: the global prefix, URI versioning and the validation
  // pipes are part of the request pipeline these tests are exercising.
  const { VersioningType } = await import('@nestjs/common');
  const { SanitizePipe } = await import('@oppenheimer/backend-core');
  const { ZodValidationPipe } = await import('nestjs-zod');

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());

  await app.listen(0);
  return {
    app,
    baseUrl: (await app.getUrl()).replace('[::1]', '127.0.0.1'),
    dataSource: moduleRef.get(DataSource),
  };
}

export async function stopCredentialApi(api: CredentialApi | undefined): Promise<void> {
  await api?.app.close();
  // `app.close()` does not reach it: see `emailQueue`.
  const { emailQueue } = await import('../infrastructure/email-queue.util');
  await emailQueue.close().catch(() => {});
}

export interface CallOptions {
  method?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export const REDIRECT_URI = 'http://127.0.0.1:9/callback';

export interface OAuthCodeGrant {
  clientId: string;
  code: string;
  verifier: string;
}

/**
 * The flows, over the application `api()` answers once `startCredentialApi`
 * has run, so a spec can take them at `describe` time.
 */
export function credentialFlows(api: () => CredentialApi) {
  async function call(path: string, options: CallOptions = {}) {
    const response = await fetch(`${api().baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    return {
      status: response.status,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
    };
  }

  /**
   * Register a user through Better Auth and return a bearer session token. The
   * address is marked verified unless asked otherwise, as following the
   * verification email would: minting a token needs it (`TOKEN_010`).
   */
  async function signUp(email: string, { verified = true }: { verified?: boolean } = {}) {
    const { app, baseUrl, dataSource } = api();
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Integration-test-password-1',
        name: 'Integration Owner',
        firstName: 'Integration',
        lastName: 'Owner',
      }),
    });

    expect(response.ok).toBe(true);
    const sessionToken = response.headers.get('set-auth-token');
    expect(sessionToken).toBeTruthy();

    const payload = (await response.json()) as {
      user: { id: string; email: string };
    };
    if (verified) {
      await dataSource.query('UPDATE "user" SET "emailVerified" = true WHERE "id" = $1', [
        payload.user.id,
      ]);
      await app.get<SessionCachePort>(SESSION_CACHE).refreshUser(payload.user.id);
    }
    return {
      id: payload.user.id,
      email: payload.user.email,
      sessionToken: sessionToken as string,
    };
  }

  /** Register a public MCP client, as one does on first use. */
  async function registerOAuthClient(): Promise<string> {
    const response = await fetch(`${api().baseUrl}/api/auth/mcp/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'integration client',
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: 'none',
      }),
    });
    expect(response.ok).toBe(true);
    return ((await response.json()) as { client_id: string }).client_id;
  }

  /** Authorize as the session's account: the code a client would be redirected with. */
  async function authorizeOAuthCode(
    sessionToken: string,
    clientId: string,
  ): Promise<OAuthCodeGrant> {
    const { baseUrl } = api();
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const query = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'openid tokens:read',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    const authorized = await fetch(`${baseUrl}/api/auth/mcp/authorize?${query}`, {
      headers: { authorization: `Bearer ${sessionToken}` },
      redirect: 'manual',
    });
    const location = authorized.headers.get('location') ?? '';
    const code = new URL(location, baseUrl).searchParams.get('code');
    expect(code, `authorize answered ${authorized.status} ${location}`).toBeTruthy();
    return { clientId, code: code as string, verifier };
  }

  /**
   * Exchange a code at the token endpoint, as a form (what clients send) or
   * as JSON with the code in whatever shape `codeAs` gives it.
   */
  async function exchangeCode(
    grant: OAuthCodeGrant,
    { codeAs }: { codeAs?: (code: string) => unknown } = {},
  ) {
    const fields = {
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      client_id: grant.clientId,
      code_verifier: grant.verifier,
    };
    const exchanged = await fetch(
      `${api().baseUrl}/api/auth/mcp/token`,
      codeAs
        ? {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...fields, code: codeAs(grant.code) }),
          }
        : {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ ...fields, code: grant.code }),
          },
    );
    const text = await exchanged.text();
    return {
      status: exchanged.status,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : undefined,
    };
  }

  async function exchangeOAuthCode(sessionToken: string, clientId: string) {
    return exchangeCode(await authorizeOAuthCode(sessionToken, clientId));
  }

  async function oauthGrantCount(userId: string): Promise<number> {
    const rows: { n: number }[] = await api().dataSource.query(
      'SELECT count(*)::int AS n FROM "oauthAccessToken" WHERE "userId" = $1',
      [userId],
    );
    return rows[0].n;
  }

  /** "Forgot password", followed through: the reset link's token, then the new password. */
  async function resetPassword(account: { id: string; email: string }) {
    const reset = await attemptPasswordReset(account);
    expect(reset.ok).toBe(true);
  }

  async function attemptPasswordReset(account: { id: string; email: string }) {
    const { baseUrl, dataSource } = api();
    const requested = await fetch(`${baseUrl}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: account.email, redirectTo: 'http://localhost:3000/reset' }),
    });
    expect(requested.ok).toBe(true);
    const [verification]: { identifier: string }[] = await dataSource.query(
      `SELECT "identifier" FROM "verification"
        WHERE "value" = $1 AND "identifier" LIKE 'reset-password:%'`,
      [account.id],
    );
    return fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: verification.identifier.slice('reset-password:'.length),
        newPassword: 'Integration-test-password-2',
      }),
    });
  }

  return {
    call,
    signUp,
    registerOAuthClient,
    authorizeOAuthCode,
    exchangeCode,
    exchangeOAuthCode,
    oauthGrantCount,
    resetPassword,
    attemptPasswordReset,
  };
}

/** An `EmailService` whose every send succeeds and goes nowhere. */
function deliveredNowhere(): EmailService {
  return new Proxy({} as EmailService, {
    get: (_target, key) =>
      typeof key === 'string' && key.startsWith('send') ? async () => undefined : undefined,
  });
}
