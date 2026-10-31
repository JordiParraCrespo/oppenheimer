import { ConfigService } from '@nestjs/config';
import { AppError } from '../errors/app.error';
import type { RefusalReader, UpstreamLimiter } from './upstream-limiter';

/**
 * What a call to Google counts against: one Google account (a connection, so a
 * person with several has a bucket per account, and one paused account does
 * not stop the others), and the project every account shares.
 */
export type GoogleBucket = 'project' | `connection:${string}`;

/** Google's per-project quota: every connected account draws on it. */
export const GOOGLE_PROJECT_BUCKET: GoogleBucket = 'project';

/** The buckets a call made with a connection's grant counts against. */
export function googleBucketsOf(connectionId: string): GoogleBucket[] {
  return [`connection:${connectionId}`, GOOGLE_PROJECT_BUCKET];
}

/**
 * Which quota a refusal counts against: `either` reads the reason Google
 * named; `person` pauses only the account, as a send does, since Gmail's
 * sending limit is the person's whatever reason it gives.
 */
export type GoogleQuota = 'person' | 'either';

/** What the token endpoint gave for an authorization code. */
export interface GoogleCodeGrant {
  refreshToken: string | null;
  /** The ID token, unparsed: the caller reads the account it names. */
  idToken: unknown;
  scopes: string[];
}

/** An access token minted from a refresh token, never kept beyond one call. */
export interface GoogleAccessToken {
  accessToken: string;
  /** Present when the grant holds `openid`. */
  idToken: unknown;
}

export interface GoogleOAuthClientOptions {
  /**
   * The config section holding `googleAuthUrl` and `googleOauthBaseUrl`
   * (`calendar`, `mail`): each grant points at Google through its own.
   */
  configPrefix: string;
  /** The console path Google redirects to, under `app.frontendUrl`. */
  redirectPath: string;
  /** The integration's one limiter, which owns its rate-limit code. */
  limiter: UpstreamLimiter;
  timeoutMs: number;
  /** The message of a provider error when Google could not be reached and said nothing. */
  unreachableMessage: string;
  /** The integration's own errors: a grant that is gone, and any other fault. */
  errors: {
    grantRevoked: (message: string) => Error;
    provider: (message: string) => Error;
  };
}

/** Google's reasons for a per-person quota refusal, and for a per-project one. */
const PERSON_REASONS = new Set(['userRateLimitExceeded']);
const PROJECT_REASONS = new Set(['rateLimitExceeded', 'quotaExceeded', 'dailyLimitExceeded']);

/**
 * A grant of Google's, through the same OAuth client as Google sign-in
 * (`oauth.google.*`): the consent URL, the code exchange, access tokens from a
 * refresh token, revocation, and every other call the integration makes to
 * Google with them. Every call goes through the integration's
 * {@link UpstreamLimiter}, a refusal pausing whichever bucket Google named
 * (`.agents/rules/integrations.md`); its rate-limit problem passes through as
 * is, and anything else that kept Google from answering is the integration's
 * provider error.
 */
export class GoogleOAuthClient {
  constructor(
    private readonly configService: ConfigService,
    private readonly options: GoogleOAuthClientOptions,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** The consent screen for `scope`, offline, letting the person pick any account. */
  authorizationUrl(scope: string, state: string, loginHint?: string): string {
    const url = new URL(this.config('googleAuthUrl'));
    url.searchParams.set('client_id', this.clientId ?? '');
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', `openid email ${scope}`);
    url.searchParams.set('access_type', 'offline');
    // `select_account`: a second account can be chosen, not the one signed in.
    url.searchParams.set('prompt', 'consent select_account');
    if (loginHint) url.searchParams.set('login_hint', loginHint);
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    return url.toString();
  }

  /** Spends an authorization code; it counts against the project alone, as no account is known yet. */
  async exchangeCode(code: string): Promise<GoogleCodeGrant> {
    const body = await this.token(
      { code, redirect_uri: this.redirectUri, grant_type: 'authorization_code' },
      [GOOGLE_PROJECT_BUCKET],
    );
    return {
      refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
      idToken: body.id_token,
      scopes: typeof body.scope === 'string' ? body.scope.split(' ') : [],
    };
  }

  async accessToken(refreshToken: string, buckets: GoogleBucket[]): Promise<GoogleAccessToken> {
    const token = await this.token(
      { refresh_token: refreshToken, grant_type: 'refresh_token' },
      buckets,
    );
    if (typeof token.access_token !== 'string') {
      throw this.options.errors.provider('Google returned no access token');
    }
    return { accessToken: token.access_token, idToken: token.id_token };
  }

  /** Revokes the grant at Google; a failure is swallowed, since the grant is dropped either way. */
  async revoke(refreshToken: string, buckets: GoogleBucket[]): Promise<void> {
    const url = new URL(`${this.config('googleOauthBaseUrl')}/revoke`);
    url.searchParams.set('token', refreshToken);
    await this.fetch(url, { method: 'POST' }, buckets).catch(() => undefined);
  }

  /**
   * Every call to Google, through the limiter. `buckets[0]` is the one a
   * per-person refusal pauses.
   */
  async fetch(
    url: URL,
    init: RequestInit,
    buckets: GoogleBucket[],
    quota: GoogleQuota = 'either',
  ): Promise<{ response: Response; errorBody: string | null }> {
    try {
      return await this.options.limiter.exchange(
        buckets,
        () => fetch(url, { ...init, signal: AbortSignal.timeout(this.options.timeoutMs) }),
        readQuotaRefusal(buckets[0], quota),
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw this.options.errors.provider(
        error instanceof Error ? error.message : this.options.unreachableMessage,
      );
    }
  }

  /** Google's token endpoint. `invalid_grant` is a grant that is gone, not a fault. */
  private async token(
    fields: Record<string, string>,
    buckets: GoogleBucket[],
  ): Promise<Record<string, unknown>> {
    const { response, errorBody } = await this.fetch(
      new URL(`${this.config('googleOauthBaseUrl')}/token`),
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId ?? '',
          client_secret: this.clientSecret ?? '',
          ...fields,
        }).toString(),
      },
      buckets,
    );
    if (errorBody !== null) {
      if (jsonOf(errorBody).error === 'invalid_grant') {
        throw this.options.errors.grantRevoked('invalid_grant');
      }
      throw this.options.errors.provider(`Google token endpoint answered ${response.status}`);
    }
    return jsonOf(await response.text());
  }

  private config(key: 'googleAuthUrl' | 'googleOauthBaseUrl'): string {
    return this.configService.getOrThrow<string>(`${this.options.configPrefix}.${key}`);
  }

  private get clientId(): string | undefined {
    return this.configService.get<string>('oauth.google.clientId') || undefined;
  }

  private get clientSecret(): string | undefined {
    return this.configService.get<string>('oauth.google.clientSecret') || undefined;
  }

  private get redirectUri(): string {
    return `${this.configService.getOrThrow<string>('app.frontendUrl')}${this.options.redirectPath}`;
  }
}

/**
 * Google names a quota refusal in `error.errors[].reason` or `error.status`
 * (`RESOURCE_EXHAUSTED`), and sends it as a 403 as often as a 429. A
 * per-person reason pauses the grant; a per-project one pauses every grant.
 */
function readQuotaRefusal(personBucket: GoogleBucket, quota: GoogleQuota): RefusalReader {
  return (errorBody) => {
    const error = record(jsonOf(errorBody).error);
    const reasons = list(error.errors).map((entry) => String(record(entry).reason ?? ''));
    const limited =
      reasons.some((reason) => PERSON_REASONS.has(reason) || PROJECT_REASONS.has(reason)) ||
      error.status === 'RESOURCE_EXHAUSTED';
    if (quota === 'person' && limited) return { limited: true, bucket: personBucket };
    if (reasons.some((reason) => PERSON_REASONS.has(reason))) {
      return { limited: true, bucket: personBucket };
    }
    if (
      reasons.some((reason) => PROJECT_REASONS.has(reason)) ||
      error.status === 'RESOURCE_EXHAUSTED'
    ) {
      return { limited: true, bucket: GOOGLE_PROJECT_BUCKET };
    }
    return { limited: false };
  };
}

function jsonOf(text: string): Record<string, unknown> {
  try {
    return record(JSON.parse(text));
  } catch {
    return {};
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
