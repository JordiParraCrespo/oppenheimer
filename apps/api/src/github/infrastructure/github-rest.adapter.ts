import { createSign } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError, CapabilitiesService } from '@oppenheimer/backend-core';
import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { GithubErrors } from '../domain/github.errors';
import { GITHUB_FETCH } from '../github.di-tokens';
import type {
  GithubAppPort,
  GithubBranch,
  GithubInstallationClaim,
  GithubInstallationRef,
  GithubRepository,
  GithubRepositoryToken,
} from './github-app.port';

const API = 'https://api.github.com';
const OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';

/** GitHub's REST API version, pinned so a future default cannot move under us. */
const API_VERSION = '2022-11-28';
/** GitHub requires a User-Agent and refuses requests without one. */
const USER_AGENT = 'oppenheimer-control-plane';
/** A listing the picker is waiting on is worth failing fast rather than hanging. */
const REQUEST_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 100;
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
  error?: string;
}

/** What this adapter needs of `fetch`, so a double can stand in for it. */
export type GithubFetch = typeof globalThis.fetch;

/** What a refusal means at one call site, by status. */
type StatusMap = Partial<Record<number, ErrorDefinition>>;

interface RequestOptions {
  /** Bearer credential. Absent for the OAuth exchange, which authenticates by body. */
  token?: string;
  method?: string;
  body?: unknown;
  accept?: string;
  /**
   * Statuses this call site has a specific answer for. Everything else follows
   * the default reading in {@link errorFor} — which is what keeps a suspended
   * install, a bad App key and a rate limit from collapsing into one code.
   */
  onStatus?: StatusMap;
}

/**
 * The only file that talks to GitHub.
 *
 * It is written on the platform `fetch` and `node:crypto` rather than a client
 * library, deliberately: the surface is five endpoints, an RS256 JWT and one
 * pagination rule, and a dependency for that is a dependency to keep current,
 * audit and resolve at install time.
 *
 * Everything it returns is in this module's own vocabulary, so a change of
 * transport is a change to this file and nothing else. Its other job is to make
 * GitHub's failures into this module's problem documents: an unmapped upstream
 * error would reach a client as a bare 500 with no code.
 *
 * **Nothing here logs a response body.** The access-token endpoint answers with
 * a live credential, and a log line is the easiest place to leak one.
 */
@Injectable()
export class GithubRestAdapter implements GithubAppPort {
  private readonly logger = new Logger(GithubRestAdapter.name);
  private readonly http: GithubFetch;

  constructor(
    private readonly configService: ConfigService,
    private readonly capabilities: CapabilitiesService,
    /**
     * Left unbound in the composition root, so the platform `fetch` is used. It
     * is a seam for a test double, and for a deployment that has to route egress
     * through a client of its own.
     */
    @Optional()
    @Inject(GITHUB_FETCH)
    fetchImpl?: GithubFetch,
  ) {
    this.http = fetchImpl ?? globalThis.fetch;
  }

  /**
   * One predicate, shared with the capability.
   *
   * Asking `CapabilitiesService` rather than re-reading config is the point: the
   * two used to be different subsets, so a deployment with no `GITHUB_APP_SLUG`
   * reported `github_app: false` and still answered `POST /installations` 201.
   */
  isConfigured(): boolean {
    return this.capabilities.has('github_app');
  }

  async listUserInstallations(code: string): Promise<GithubInstallationRef[]> {
    this.assertConfigured();

    // The code is exchanged once, here, and never stored. What it buys is the one
    // thing a forged installation id cannot fake: GitHub's own answer to "which
    // installations can this account see".
    const userToken = await this.exchangeCode(code);
    const installations = await this.paginate<RawInstallation>(
      `${API}/user/installations`,
      userToken,
      (body) => collectionOf<RawInstallation>(body, 'installations'),
    );

    return installations.map((installation) => ({ githubInstallationId: installation.id }));
  }

  async readInstallation(githubInstallationId: number): Promise<GithubInstallationClaim> {
    this.assertConfigured();

    const { body } = await this.request<RawInstallation>(
      `${API}/app/installations/${githubInstallationId}`,
      {
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
      `${API}/installation/repositories`,
      token,
      (body) => collectionOf<RawRepository>(body, 'repositories'),
    );

    return repositories.map(toRepository);
  }

  /**
   * One repository, resolved by id. GitHub refuses it when the installation does
   * not cover it, and that refusal *is* `GITHUB_010` — asking it here is cheaper
   * and more current than rebuilding the installation's whole repository set in
   * process to answer a question GitHub already answers.
   */
  async readRepository(
    githubInstallationId: number,
    githubRepoId: number,
  ): Promise<GithubRepository> {
    const token = await this.installationToken(githubInstallationId);
    return toRepository(await this.rawRepository(token, githubRepoId));
  }

  /** The raw row, so the two readers above cannot drift on the refusal mapping. */
  private async rawRepository(token: string, githubRepoId: number): Promise<RawRepository> {
    const { body } = await this.request<RawRepository>(`${API}/repositories/${githubRepoId}`, {
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
    const repository = await this.rawRepository(token, githubRepoId);

    const [owner, name] = repository.full_name.split('/');
    const branches = await this.paginate<RawBranch>(
      `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/branches`,
      token,
      (body) => (Array.isArray(body) ? (body as RawBranch[]) : []),
      {
        403: GithubErrors.REPOSITORY_NOT_IN_INSTALLATION,
        404: GithubErrors.REPOSITORY_NOT_IN_INSTALLATION,
      },
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
    // Narrowed to one repository with contents and metadata only, and a live call
    // every time — so it fails the moment that repository leaves the installation
    // (`product/versions/mvp/03-control-plane.md`).
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
      `${API}/app/installations/${githubInstallationId}/access_tokens`,
      {
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
   * The OAuth code from the install redirect, exchanged for a user token.
   *
   * GitHub answers a rejected code with **200** and an `error` field rather than
   * a 4xx, so the status alone would report success on the one failure that
   * matters here.
   */
  private async exchangeCode(code: string): Promise<string> {
    const { body } = await this.request<RawOauthToken>(OAUTH_TOKEN_URL, {
      method: 'POST',
      accept: 'application/json',
      body: { client_id: this.clientId, client_secret: this.clientSecret, code },
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
    return body.access_token;
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

  /** Walk `Link: rel="next"` until GitHub stops offering one. */
  private async paginate<T>(
    url: string,
    token: string,
    pick: (body: unknown) => T[],
    onStatus?: StatusMap,
  ): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined = withPageSize(url);

    for (let page = 0; page < MAX_PAGES && next; page += 1) {
      const { body, link } = await this.request<unknown>(next, { token, onStatus });
      items.push(...pick(body));
      next = nextPageUrl(link);
    }

    return items;
  }

  /**
   * One request, with its failure folded onto the catalog.
   *
   * The credential travels in the `Authorization` header and never in the URL,
   * which is what lets the log line and the problem document name the request at
   * all. Neither carries the response body: this is the code path that mints
   * credentials.
   */
  private async request<T>(
    url: string,
    options: RequestOptions,
  ): Promise<{ body: T; link: string | null }> {
    let response: Response;
    try {
      response = await this.http(url, {
        method: options.method ?? 'GET',
        headers: {
          accept: options.accept ?? 'application/vnd.github+json',
          'x-github-api-version': API_VERSION,
          'user-agent': USER_AGENT,
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // A timeout, a DNS failure, a reset: GitHub did not answer at all, which is
      // never a 4xx no matter what the call site expected.
      this.logger.warn(
        { message: 'GitHub could not be reached', url: pathOf(url) },
        error instanceof Error ? error.stack : String(error),
      );
      throw new AppError(GithubErrors.UPSTREAM_FAILED, {
        detail: 'GitHub could not be reached.',
        extensions: { upstreamStatus: null },
      });
    }

    if (!response.ok) {
      this.logger.warn({
        message: 'GitHub rejected a request',
        url: pathOf(url),
        status: response.status,
      });
      // The error body carries GitHub's own sentence and no credential; the
      // success body of this same endpoint does, which is why only this branch
      // reads one.
      const upstreamMessage = await messageOf(response);
      throw new AppError(errorFor(response.status, options.onStatus), {
        detail: upstreamMessage ?? 'GitHub answered this request with an error.',
        extensions: { upstreamStatus: response.status },
      });
    }

    return { body: (await response.json()) as T, link: response.headers.get('link') };
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

/**
 * What a status means when the call site has not said.
 *
 * `401` is never the caller's fault: the App JWT did not verify or the
 * credentials are wrong, which is a deployment problem and says so. Everything
 * else — `422`, `429`, any 5xx — is upstream trouble, and GitHub's own sentence
 * travels in `detail`.
 */
function errorFor(status: number, onStatus?: StatusMap): ErrorDefinition {
  const named = onStatus?.[status];
  if (named) return named;
  if (status === 401) return GithubErrors.APP_NOT_CONFIGURED;
  return GithubErrors.UPSTREAM_FAILED;
}

/** GitHub's own sentence for a refusal. Never read from a successful response. */
async function messageOf(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === 'string' ? body.message : undefined;
  } catch {
    return undefined;
  }
}

/** JWT segments are base64url with the padding stripped. */
function base64url(value: Buffer): string {
  return value.toString('base64url');
}

function withPageSize(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}per_page=${PAGE_SIZE}`;
}

/** `<https://api.github.com/…?page=2>; rel="next", <…>; rel="last"` */
function nextPageUrl(link: string | null): string | undefined {
  if (!link) return undefined;
  for (const part of link.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part.trim());
    if (match) return match[1];
  }
  return undefined;
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

/** The path alone, so a log line names the request without its query string. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
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
