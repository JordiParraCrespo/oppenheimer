import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, type RefusalReader, UpstreamLimiter } from '@oppenheimer/backend-core';
import { CalendarErrors } from '../domain/calendar.errors';
import {
  type CalendarGrant,
  CalendarGrantRevokedError,
  CalendarProviderError,
  type CalendarProviderPort,
  type CalendarReadGrant,
  GOOGLE_CALENDAR_SCOPE,
  type ProviderCalendarEvent,
  type ProviderEventsRead,
} from './calendar-provider.port';
import { accountOfIdToken, googleEventsToProvider, nextDay } from './google-calendar-event.util';

/** A page is 2 500 events at most; a month of anyone's calendar fits in one or two. */
const PAGE_SIZE = 2500;
const MAX_PAGES = 4;
const TIMEOUT_MS = 10_000;
/**
 * A month view is one token refresh and a page or two per connected account,
 * read in parallel: five accounts is ten to fifteen calls. Eight in flight per
 * process keeps one person's month from queueing behind itself, and a burst
 * past forty waiting answers `CALENDAR_010` rather than hanging the card.
 */
const LIMITS = { maxInFlight: 8, maxQueued: 40, maxWaitMs: 5_000 };
/** Google's per-project quota: every connected account draws on it. */
const PROJECT: Bucket = 'project';
/** Google's reasons for a per-person quota refusal, and for a per-project one. */
const PERSON_REASONS = new Set(['userRateLimitExceeded']);
const PROJECT_REASONS = new Set(['rateLimitExceeded', 'quotaExceeded', 'dailyLimitExceeded']);

type Bucket = 'project' | `connection:${string}`;

/**
 * Google Calendar, read-only, through the same OAuth client as Google sign-in. The
 * redirect lands on the console (`/plan/calendar/google`), which posts the code back,
 * as Connect GitHub does; so the redirect URI is the console's.
 *
 * Google counts calls per Google account and per project, and enforces both.
 * Every call here goes through one {@link UpstreamLimiter}: a call counts
 * against its connection (one Google account, so one bucket each when a person
 * has several) and the project, a refusal pauses whichever Google named, and
 * a paused bucket answers `CALENDAR_010` without asking Google again, on every
 * replica (`.agents/rules/integrations.md`).
 */
@Injectable()
export class GoogleCalendarGateway implements CalendarProviderPort {
  private readonly limiter: UpstreamLimiter;

  constructor(
    private readonly configService: ConfigService,
    @Optional() cache?: CacheService,
  ) {
    this.limiter = new UpstreamLimiter(
      'Google Calendar',
      CalendarErrors.GOOGLE_RATE_LIMITED,
      cache,
      LIMITS,
    );
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  authorizationUrl(state: string, loginHint?: string): string {
    const url = new URL(this.config('googleAuthUrl'));
    url.searchParams.set('client_id', this.clientId ?? '');
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', `openid email ${GOOGLE_CALENDAR_SCOPE}`);
    url.searchParams.set('access_type', 'offline');
    // `select_account`: a second account can be chosen, not the one signed in.
    url.searchParams.set('prompt', 'consent select_account');
    if (loginHint) url.searchParams.set('login_hint', loginHint);
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchange(code: string): Promise<CalendarGrant> {
    const body = await this.token(
      { code, redirect_uri: this.redirectUri, grant_type: 'authorization_code' },
      [PROJECT],
    );
    return {
      refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
      account: accountOfIdToken(body.id_token),
      scopes: typeof body.scope === 'string' ? body.scope.split(' ') : [],
    };
  }

  async listEvents(
    grant: CalendarReadGrant,
    range: { from: string; to: string; timeZone: string },
  ): Promise<ProviderEventsRead> {
    const buckets = bucketsOf(grant.connectionId);
    const token = await this.token(
      { refresh_token: grant.refreshToken, grant_type: 'refresh_token' },
      buckets,
    );
    if (typeof token.access_token !== 'string') {
      throw new CalendarProviderError('Google returned no access token');
    }
    const accessToken = token.access_token;
    const events: ProviderCalendarEvent[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const url = new URL(
        `${this.config('googleApiBaseUrl')}/calendar/v3/calendars/primary/events`,
      );
      // A day either side of the range in UTC covers every zone; the util keeps
      // only the days asked for, read in `timeZone`.
      url.searchParams.set('timeMin', `${previousDay(range.from)}T00:00:00Z`);
      url.searchParams.set('timeMax', `${nextDay(nextDay(range.to))}T00:00:00Z`);
      url.searchParams.set('timeZone', range.timeZone);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', String(PAGE_SIZE));
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const { response, errorBody } = await this.fetch(
        url,
        { headers: { authorization: `Bearer ${accessToken}` } },
        buckets,
      );
      if (response.status === 401) throw new CalendarGrantRevokedError('Google refused the token');
      if (errorBody !== null) throw new CalendarProviderError(`Google answered ${response.status}`);
      const body = (await response.json()) as { nextPageToken?: unknown };
      events.push(...googleEventsToProvider(body, range));
      pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : undefined;
      if (!pageToken) break;
    }
    // A grant that holds `openid` gets an ID token on refresh too: what keys a
    // connection written before accounts were keyed by `sub`.
    return { events, account: accountOfIdToken(token.id_token) };
  }

  async revoke(grant: CalendarReadGrant): Promise<void> {
    const url = new URL(`${this.config('googleOauthBaseUrl')}/revoke`);
    url.searchParams.set('token', grant.refreshToken);
    await this.fetch(url, { method: 'POST' }, bucketsOf(grant.connectionId)).catch(() => undefined);
  }

  /** Google's token endpoint. `invalid_grant` is a grant that is gone, not a fault. */
  private async token(
    fields: Record<string, string>,
    buckets: Bucket[],
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
        throw new CalendarGrantRevokedError('invalid_grant');
      }
      throw new CalendarProviderError(`Google token endpoint answered ${response.status}`);
    }
    return jsonOf(await response.text());
  }

  /**
   * Every call to Google, through the limiter. Its rate-limit problem
   * (`CALENDAR_010`) passes through as is; anything else that kept Google from
   * answering is a `CalendarProviderError`.
   */
  private async fetch(
    url: URL,
    init: RequestInit,
    buckets: Bucket[],
  ): Promise<{ response: Response; errorBody: string | null }> {
    try {
      return await this.limiter.exchange(
        buckets,
        () => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }),
        readQuotaRefusal(buckets[0]),
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new CalendarProviderError(
        error instanceof Error ? error.message : 'Google unreachable',
      );
    }
  }

  private config(key: 'googleAuthUrl' | 'googleOauthBaseUrl' | 'googleApiBaseUrl'): string {
    return this.configService.getOrThrow<string>(`calendar.${key}`);
  }

  private get clientId(): string | undefined {
    return this.configService.get<string>('oauth.google.clientId') || undefined;
  }

  private get clientSecret(): string | undefined {
    return this.configService.get<string>('oauth.google.clientSecret') || undefined;
  }

  private get redirectUri(): string {
    return `${this.configService.getOrThrow<string>('app.frontendUrl')}/plan/calendar/google`;
  }
}

function previousDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/**
 * What a call counts against: the Google account, which is one connection (so
 * a person with several has a bucket per account, and one paused account does
 * not stop the others), and the project every account shares.
 */
function bucketsOf(connectionId: string): Bucket[] {
  return [`connection:${connectionId}`, PROJECT];
}

/**
 * Google names a quota refusal in `error.errors[].reason` (Calendar's v3
 * shape) or `error.status` (`RESOURCE_EXHAUSTED`), and sends it as a 403 as
 * often as a 429. A per-person reason pauses the grant; a per-project one
 * pauses every grant.
 */
function readQuotaRefusal(personBucket: Bucket): RefusalReader {
  return (errorBody) => {
    const error = jsonOf(errorBody).error;
    const record =
      typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
    const reasons = Array.isArray(record.errors)
      ? record.errors.map((entry) => String((entry as { reason?: unknown })?.reason ?? ''))
      : [];
    if (reasons.some((reason) => PERSON_REASONS.has(reason))) {
      return { limited: true, bucket: personBucket };
    }
    if (
      reasons.some((reason) => PROJECT_REASONS.has(reason)) ||
      record.status === 'RESOURCE_EXHAUSTED'
    ) {
      return { limited: true, bucket: PROJECT };
    }
    return { limited: false };
  };
}

function jsonOf(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
