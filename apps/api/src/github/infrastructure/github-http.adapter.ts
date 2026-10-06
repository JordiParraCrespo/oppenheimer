import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, type RefusalReader, UpstreamLimiter } from '@oppenheimer/backend-core';
import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { GithubErrors } from '../domain/github.errors';
import { GITHUB_FETCH } from '../github.di-tokens';
import type { GithubBucket } from './github-pulls.port';

/** GitHub's REST API version, pinned so a future default cannot move under us. */
const API_VERSION = '2022-11-28';
/** GitHub requires a User-Agent and refuses requests without one. */
const USER_AGENT = 'oppenheimer-control-plane';
/** A listing the picker is waiting on is worth failing fast rather than hanging. */
const REQUEST_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 100;

/**
 * GitHub's secondary limit starts at 100 concurrent requests across the App;
 * eight from each process leaves room for the other replicas. A queue page fans
 * out five reads per open pull request, so up to a hundred more may wait their
 * turn, for at most five seconds, before the page answers `GITHUB_015` instead
 * of hanging on GitHub's budget.
 */
const LIMITS = { maxInFlight: 8, maxQueued: 100, maxWaitMs: 5_000 };

/**
 * GitHub refuses a secondary-limit breach with a 403 that may carry no
 * rate-limit header; its sentence is the only tell.
 */
const SECONDARY_LIMIT = /secondary rate limit|rate limit exceeded|abuse detection/i;

/** What a refusal means at one call site, by status. */
export type StatusMap = Partial<Record<number, ErrorDefinition>>;

/** What the client needs of `fetch`, so a double can stand in for it. */
export type GithubFetch = typeof globalThis.fetch;

export interface GithubRequest {
  /** What GitHub counts this call against: what a rate-limit pause covers. */
  bucket: GithubBucket;
  /** Bearer credential. Absent for the OAuth exchange, which authenticates by body. */
  token?: string;
  method?: string;
  body?: unknown;
  accept?: string;
  /**
   * Statuses this call site has a specific answer for. A `401` is the caller's
   * to name (`unauthorized`): the App's credentials for the App adapter, the
   * person's grant for the pull-requests one. Anything else is `GITHUB_009`.
   */
  onStatus?: StatusMap;
  unauthorized: ErrorDefinition;
}

/**
 * The only thing in this module that sends a request to GitHub. Both adapters
 * call it, so there is one `request()` and every call takes the same path
 * through {@link UpstreamLimiter}: the pause checked inside the in-flight slot,
 * a refusal for rate answered as `GITHUB_015` (a 429 with `Retry-After`) before
 * any call site can read its 403 as a suspended installation, and a spent
 * budget pausing the bucket until GitHub's reset, on every replica.
 *
 * **Nothing here logs a token or reads a success body it does not return.** The
 * access-token endpoint answers with a live credential, and a log line is the
 * easiest place to leak one.
 */
@Injectable()
export class GithubHttp {
  private readonly logger = new Logger(GithubHttp.name);
  private readonly fetch: GithubFetch;
  private readonly limiter: UpstreamLimiter;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(GITHUB_FETCH)
    fetchImpl?: GithubFetch,
    @Optional()
    cache?: CacheService,
  ) {
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.limiter = new UpstreamLimiter('GitHub', GithubErrors.RATE_LIMITED, cache, LIMITS);
  }

  /**
   * GitHub's REST root, without a trailing slash. Configuration rather than a
   * constant since GitHub Enterprise Server serves the same API on somebody
   * else's host — and since an end-to-end run has to reach a stub to exercise a
   * path that needs a repository without registering an App (`e2e/README.md`).
   */
  get api(): string {
    return (
      this.configService.get<string>('githubApp.apiBaseUrl') ?? 'https://api.github.com'
    ).replace(/\/+$/, '');
  }

  /**
   * One request, with its failure folded onto the catalog. The credential
   * travels in the `Authorization` header and never in the URL, which is what
   * lets the log line and the problem document name the request at all.
   */
  async request<T>(url: string, options: GithubRequest): Promise<{ body: T; link: string | null }> {
    let exchanged: Awaited<ReturnType<typeof this.limiter.exchange<Response>>>;
    try {
      exchanged = await this.limiter.exchange(
        options.bucket,
        () =>
          this.fetch(url, {
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
          }),
        readSecondaryLimit,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
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

    const { response, errorBody } = exchanged;
    if (errorBody !== null) {
      this.logger.warn({
        message: 'GitHub rejected a request',
        url: pathOf(url),
        status: response.status,
      });
      const named =
        options.onStatus?.[response.status] ??
        (response.status === 401 ? options.unauthorized : GithubErrors.UPSTREAM_FAILED);
      throw new AppError(named, {
        detail: messageOf(errorBody) ?? 'GitHub answered this request with an error.',
        extensions: { upstreamStatus: response.status },
      });
    }

    const text = await response.text();
    return { body: (text ? JSON.parse(text) : {}) as T, link: response.headers.get('link') };
  }

  /**
   * Every page GitHub offers, up to `maxPages`. `Link` comes from upstream, so
   * the cap is what stops a malformed or self-referential header from looping.
   */
  async paginate<T>(
    url: string,
    options: GithubRequest,
    pick: (body: unknown) => T[],
    maxPages: number,
  ): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined = `${url}${url.includes('?') ? '&' : '?'}per_page=${PAGE_SIZE}`;
    for (let page = 0; page < maxPages && next; page += 1) {
      const { body, link } = await this.request<unknown>(next, options);
      items.push(...pick(body));
      next = nextPageUrl(link);
    }
    return items;
  }
}

/** A 403 whose sentence names a secondary limit, which no header may say. */
const readSecondaryLimit: RefusalReader = (errorBody) => ({
  limited: SECONDARY_LIMIT.test(messageOf(errorBody) ?? ''),
});

/** GitHub's own sentence for a refusal. Never read from a successful response. */
function messageOf(errorBody: string): string | undefined {
  try {
    const body = JSON.parse(errorBody) as { message?: unknown };
    return typeof body.message === 'string' ? body.message : undefined;
  } catch {
    return undefined;
  }
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

/** The path alone, so a log line names the request without its query string. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
