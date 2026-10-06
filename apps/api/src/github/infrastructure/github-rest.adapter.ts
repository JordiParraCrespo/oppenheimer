import { createSign } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError, CapabilitiesService } from '@oppenheimer/backend-core';
import { GithubErrors } from '../domain/github.errors';
import type {
  GithubAppPort,
  GithubBranch,
  GithubInstallationClaim,
  GithubRepository,
  GithubRepositoryToken,
  GithubUserAuthorization,
  GithubUserTokens,
} from './github-app.port';
import { GithubHttp, type GithubRequest, type StatusMap } from './github-http.adapter';
import type { GithubBucket } from './github-pulls.port';

const OAUTH_TOKEN_PATH = '/login/oauth/access_token';

/**
 * A hard stop on pagination. `Link` comes from upstream, so a malformed or
 * self-referential header must not be able to loop forever; at this page size
 * the cap is ten thousand items, far past any real installation.
 */
const MAX_PAGES = 100;

/** The App JWT's own lifetime. GitHub refuses anything over ten minutes. */
const APP_JWT_TTL_SECONDS = 9 * 60;
/** Backdated a minute, because GitHub rejects a JWT whose `iat` is in its future. */
const APP_JWT_CLOCK_SKEW_SECONDS = 60;

/**
 * The fields this adapter reads off GitHub's JSON.
 *
 * Narrowing once, here, is what keeps `unknown` from spreading: everything below
 * this line is typed, and nothing untyped leaves the file.
 */
interface RawInstallation {
  id: number;
  account: { login?: unknown; slug?: unknown; type?: unknown } | null;
  repository_selection: string;
  suspended_at?: string | null;
}

interface RawRepository {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  pushed_at: string | null;
}

interface RawBranch {
  name: string;
  commit: { sha: string };
  protected?: boolean;
}

interface RawAccessToken {
  token: string;
  expires_at: string;
}

/** The OAuth exchange answers 200 with an `error` code rather than a 4xx. */
interface RawOauthToken {
  access_token?: string;
  /** Seconds. Present only with expiring user tokens. */
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
}

interface RawUser {
  id: number;
  login: string;
}

/**
 * What the App does on GitHub, on the platform `fetch` (through
 * {@link GithubHttp}, the module's one client) and `node:crypto`: seven
 * endpoints, an RS256 JWT and one pagination rule do not earn a client library
 * to keep current, audit and resolve at install time. GitHub's failures become
 * this module's problem documents, or they would reach a client as a bare 500
 * with no code.
 *
 * Each call names the budget GitHub counts it against: `app` for the App's JWT,
 * `installation:<id>` for an installation's token, `oauth` for the install
 * flow (the person's id is not known until its last call, and it runs once).
 *
 * **Nothing here logs a response body.** The access-token endpoint answers with
 * a live credential, and a log line is the easiest place to leak one.
 */
@Injectable()
export class GithubRestAdapter implements GithubAppPort {
  constructor(
    private readonly configService: ConfigService,
    private readonly capabilities: CapabilitiesService,
    private readonly http: GithubHttp,
  ) {}

  /**
   * One predicate, shared with the capability.
   *
   * Asking `CapabilitiesService` rather than re-reading config is the point: a
   * deployment with no `GITHUB_APP_SLUG` reports `github_app: false`, and must
   * not then answer `POST /installations` 201.
   */
  isConfigured(): boolean {
    return this.capabilities.has('github_app');
  }

  private get api(): string {
    return this.http.api;
  }

  private get oauthTokenUrl(): string {
    const base = (
      this.configService.get<string>('githubApp.oauthBaseUrl') ?? 'https://github.com'
    ).replace(/\/+$/, '');
    return `${base}${OAUTH_TOKEN_PATH}`;
  }

  async listUserInstallations(code: string): Promise<GithubUserAuthorization> {
    this.assertConfigured();

    const tokens = await this.exchangeCode({ code });
    const bucket: GithubBucket = 'oauth';
    const installations = await this.paginate<RawInstallation>(
      `${this.api}/user/installations`,
      { bucket, token: tokens.accessToken },
      (body) => collectionOf<RawInstallation>(body, 'installations'),
    );
    const { body: user } = await this.request<RawUser>(`${this.api}/user`, {
      bucket,
      token: tokens.accessToken,
    });

    return {
      installations: installations.map((installation) => ({
        githubInstallationId: installation.id,
      })),
      user: { githubUserId: user.id, login: user.login },
      tokens,
    };
  }

  async refreshUserToken(refreshToken: string): Promise<GithubUserTokens> {
    this.assertConfigured();
    return this.exchangeCode({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  async mintInstallationToken(githubInstallationId: number): Promise<GithubRepositoryToken> {
    return this.createInstallationToken(githubInstallationId, {
      onStatus: {
        403: GithubErrors.INSTALLATION_SUSPENDED,
        404: GithubErrors.INSTALLATION_NOT_FOUND,
      },
    });
  }

  async readInstallation(githubInstallationId: number): Promise<GithubInstallationClaim> {
    this.assertConfigured();

    const { body } = await this.request<RawInstallation>(
      `${this.api}/app/installations/${githubInstallationId}`,
      {
        bucket: 'app',
        token: this.appJwt(),
        onStatus: { 404: GithubErrors.INSTALLATION_NOT_FOUND },
      },
    );

    return {
      githubInstallationId: body.id,
      accountLogin: accountLoginOf(body),
      accountType: accountTypeOf(body),
      repositorySelection: body.repository_selection === 'all' ? 'all' : 'selected',
      suspendedAt: body.suspended_at ? new Date(body.suspended_at) : null,
    };
  }

  async listInstallationRepositories(githubInstallationId: number): Promise<GithubRepository[]> {
    const token = await this.installationToken(githubInstallationId);

    const repositories = await this.paginate<RawRepository>(
      `${this.api}/installation/repositories`,
      { bucket: `installation:${githubInstallationId}`, token },
      (body) => collectionOf<RawRepository>(body, 'repositories'),
    );

    return repositories.map(toRepository);
  }

  async readRepository(
    githubInstallationId: number,
    githubRepoId: number,
  ): Promise<GithubRepository> {
    const token = await this.installationToken(githubInstallationId);
    return toRepository(
      await this.rawRepository(token, `installation:${githubInstallationId}`, githubRepoId),
    );
  }

  /**
   * The raw row, so `readRepository` and `listRepositoryBranches` cannot drift
   * on the refusal mapping.
   */
  private async rawRepository(
    token: string,
    bucket: GithubBucket,
    githubRepoId: number,
  ): Promise<RawRepository> {
    const { body } = await this.request<RawRepository>(`${this.api}/repositories/${githubRepoId}`, {
      bucket,
      token,
      onStatus: {
        403: GithubErrors.REPOSITORY_NOT_IN_INSTALLATION,
        404: GithubErrors.REPOSITORY_NOT_IN_INSTALLATION,
      },
    });
    return body;
  }

  async listRepositoryBranches(
    githubInstallationId: number,
    githubRepoId: number,
  ): Promise<{ branches: GithubBranch[]; defaultBranch: string }> {
    const token = await this.installationToken(githubInstallationId);
    const bucket: GithubBucket = `installation:${githubInstallationId}`;
    const repository = await this.rawRepository(token, bucket, githubRepoId);

    const [owner, name] = repository.full_name.split('/');
    const branches = await this.paginate<RawBranch>(
      `${this.api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches`,
      {
        bucket,
        token,
        onStatus: {
          403: GithubErrors.REPOSITORY_NOT_IN_INSTALLATION,
          404: GithubErrors.REPOSITORY_NOT_IN_INSTALLATION,
        },
      },
      (body) => (Array.isArray(body) ? (body as RawBranch[]) : []),
    );

    return {
      defaultBranch: repository.default_branch,
      branches: branches.map((branch) => ({
        name: branch.name,
        commitSha: branch.commit.sha,
        protected: Boolean(branch.protected),
      })),
    };
  }

  async mintRepositoryToken(
    githubInstallationId: number,
    githubRepoId: number,
  ): Promise<GithubRepositoryToken> {
    return this.createInstallationToken(githubInstallationId, {
      repositoryIds: [githubRepoId],
      permissions: { contents: 'write', metadata: 'read' },
      onStatus: {
        403: GithubErrors.REPOSITORY_NOT_IN_INSTALLATION,
        404: GithubErrors.INSTALLATION_NOT_FOUND,
        // GitHub answers 422 when `repository_ids` names something the
        // installation does not cover, which is this module's `GITHUB_010`
        // rather than the generic "GitHub rejected the request".
        422: GithubErrors.REPOSITORY_NOT_IN_INSTALLATION,
      },
    });
  }

  /** A token for the whole installation, used for reads across it. */
  private async installationToken(githubInstallationId: number): Promise<string> {
    const minted = await this.createInstallationToken(githubInstallationId, {
      onStatus: {
        403: GithubErrors.INSTALLATION_SUSPENDED,
        404: GithubErrors.INSTALLATION_NOT_FOUND,
      },
    });
    return minted.token;
  }

  private async createInstallationToken(
    githubInstallationId: number,
    options: {
      repositoryIds?: number[];
      permissions?: Record<string, string>;
      onStatus: StatusMap;
    },
  ): Promise<GithubRepositoryToken> {
    this.assertConfigured();

    const { body } = await this.request<RawAccessToken>(
      `${this.api}/app/installations/${githubInstallationId}/access_tokens`,
      {
        bucket: 'app',
        method: 'POST',
        token: this.appJwt(),
        body: {
          ...(options.repositoryIds ? { repository_ids: options.repositoryIds } : {}),
          ...(options.permissions ? { permissions: options.permissions } : {}),
        },
        onStatus: options.onStatus,
      },
    );

    return { token: body.token, expiresAt: new Date(body.expires_at) };
  }

  /**
   * The OAuth code from the install redirect — or a refresh token — exchanged
   * for a user token.
   *
   * GitHub answers a rejected code with **200** and an `error` field rather than
   * a 4xx, so the status alone would report success on the one failure that
   * matters here.
   */
  private async exchangeCode(grant: Record<string, string>): Promise<GithubUserTokens> {
    const { body } = await this.request<RawOauthToken>(this.oauthTokenUrl, {
      bucket: 'oauth',
      method: 'POST',
      accept: 'application/json',
      body: { client_id: this.clientId, client_secret: this.clientSecret, ...grant },
      onStatus: {
        400: GithubErrors.AUTHORIZATION_CODE_REJECTED,
        401: GithubErrors.AUTHORIZATION_CODE_REJECTED,
        404: GithubErrors.AUTHORIZATION_CODE_REJECTED,
      },
    });

    if (!body.access_token) {
      throw new AppError(GithubErrors.AUTHORIZATION_CODE_REJECTED, {
        detail: 'GitHub would not exchange the authorization code from the install redirect.',
        // `bad_verification_code`, `incorrect_client_credentials`: diagnostic,
        // and carrying no secret.
        extensions: { upstreamError: body.error ?? null },
      });
    }
    const now = Date.now();
    return {
      accessToken: body.access_token,
      accessExpiresAt: body.expires_in ? new Date(now + body.expires_in * 1000) : null,
      refreshToken: body.refresh_token ?? null,
      refreshExpiresAt: body.refresh_token_expires_in
        ? new Date(now + body.refresh_token_expires_in * 1000)
        : null,
    };
  }

  /**
   * The App's own JWT: RS256 over `{ iat, exp, iss }`, signed with the App's
   * private key. It authenticates the App itself, which is what the installation
   * endpoints need.
   *
   * Minted per call rather than cached. A signature costs a millisecond, and a
   * cached JWT is one more thing that can be stale at the moment a host is
   * waiting for a credential.
   */
  private appJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
    const payload = base64url(
      Buffer.from(
        JSON.stringify({
          iat: now - APP_JWT_CLOCK_SKEW_SECONDS,
          exp: now + APP_JWT_TTL_SECONDS,
          iss: this.appId,
        }),
      ),
    );

    const signingInput = `${header}.${payload}`;
    const signature = createSign('RSA-SHA256')
      .update(signingInput)
      .sign(this.privateKey as string);

    return `${signingInput}.${base64url(signature)}`;
  }

  private paginate<T>(
    url: string,
    options: Omit<GithubRequest, 'unauthorized'>,
    pick: (body: unknown) => T[],
  ): Promise<T[]> {
    return this.http.paginate(
      url,
      { ...options, unauthorized: GithubErrors.APP_NOT_CONFIGURED },
      pick,
      MAX_PAGES,
    );
  }

  /**
   * One request through the module's client. A `401` here is never the
   * caller's fault: the App JWT did not verify or the credentials are wrong,
   * which is a deployment problem and says so.
   */
  private request<T>(
    url: string,
    options: Omit<GithubRequest, 'unauthorized'>,
  ): Promise<{ body: T; link: string | null }> {
    return this.http.request<T>(url, { ...options, unauthorized: GithubErrors.APP_NOT_CONFIGURED });
  }

  private assertConfigured(): void {
    if (this.isConfigured()) return;
    throw new AppError(GithubErrors.APP_NOT_CONFIGURED, {
      detail:
        'Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_WEBHOOK_SECRET, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET and GITHUB_APP_SLUG.',
    });
  }

  private get appId(): string | undefined {
    return this.configService.get<string>('githubApp.appId');
  }

  /**
   * The PEM key, with escaped newlines restored.
   *
   * A private key in a single-line `.env` or a container secret almost always
   * arrives with literal `\n`, and the signer rejects it with an opaque parse
   * error rather than saying so.
   */
  private get privateKey(): string | undefined {
    return this.configService.get<string>('githubApp.privateKey')?.replace(/\\n/g, '\n');
  }

  private get clientId(): string | undefined {
    return this.configService.get<string>('githubApp.clientId');
  }

  private get clientSecret(): string | undefined {
    return this.configService.get<string>('githubApp.clientSecret');
  }
}

function base64url(value: Buffer): string {
  return value.toString('base64url');
}

/**
 * Some GitHub listings wrap their items in a named field beside a `total_count`;
 * others answer a bare array. Both shapes come through here.
 */
function collectionOf<T>(body: unknown, field: string): T[] {
  if (Array.isArray(body)) return body as T[];
  const wrapped = (body as Record<string, unknown> | null)?.[field];
  return Array.isArray(wrapped) ? (wrapped as T[]) : [];
}

function toRepository(repository: RawRepository): GithubRepository {
  return {
    githubRepoId: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    defaultBranch: repository.default_branch,
    private: repository.private,
    archived: repository.archived,
    pushedAt: repository.pushed_at ?? null,
  };
}

/**
 * GitHub's `account` is a user, an organization, or an enterprise with a slug.
 *
 * A payload with none of them is refused rather than defaulted: inventing
 * `'unknown'` would put a fiction in a column the console shows, and it would
 * pass the aggregate's non-empty check by luck of the string.
 */
function accountLoginOf(installation: RawInstallation): string {
  const account = installation.account;
  if (typeof account?.login === 'string' && account.login) return account.login;
  if (typeof account?.slug === 'string' && account.slug) return account.slug;
  throw new AppError(GithubErrors.UPSTREAM_FAILED, {
    detail: 'GitHub described this installation without an account.',
    extensions: { githubInstallationId: installation.id },
  });
}

/** `User` or `Organization`, and nothing invented when GitHub says otherwise. */
function accountTypeOf(installation: RawInstallation): 'User' | 'Organization' {
  const type = installation.account?.type;
  if (type === 'User' || type === 'Organization') return type;
  throw new AppError(GithubErrors.UPSTREAM_FAILED, {
    detail: 'GitHub described this installation with an account type this app does not know.',
    extensions: { githubInstallationId: installation.id, accountType: String(type ?? '') },
  });
}
