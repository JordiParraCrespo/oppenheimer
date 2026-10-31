import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { GoogleOAuthClient, googleBucketsOf, UpstreamLimiter } from '@oppenheimer/backend-core';
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

/**
 * Google Calendar, read-only, through the same OAuth client as Google sign-in. The
 * redirect lands on the console (`/plan/calendar/google`), which posts the code back,
 * as Connect GitHub does; so the redirect URI is the console's.
 *
 * Google counts calls per Google account and per project, and enforces both.
 * Every call here goes through one {@link UpstreamLimiter}, by way of the
 * {@link GoogleOAuthClient} Gmail uses too: a call counts against its
 * connection (one Google account, so one bucket each when a person has
 * several) and the project, a refusal pauses whichever Google named, and a
 * paused bucket answers `CALENDAR_010` without asking Google again, on every
 * replica (`.agents/rules/integrations.md`). Anything else that kept Google
 * from answering is a `CalendarProviderError`.
 */
@Injectable()
export class GoogleCalendarGateway implements CalendarProviderPort {
  private readonly google: GoogleOAuthClient;

  constructor(
    private readonly configService: ConfigService,
    @Optional() cache?: CacheService,
  ) {
    this.google = new GoogleOAuthClient(configService, {
      configPrefix: 'calendar',
      redirectPath: '/plan/calendar/google',
      limiter: new UpstreamLimiter(
        'Google Calendar',
        CalendarErrors.GOOGLE_RATE_LIMITED,
        cache,
        LIMITS,
      ),
      timeoutMs: TIMEOUT_MS,
      unreachableMessage: 'Google unreachable',
      errors: {
        grantRevoked: (message) => new CalendarGrantRevokedError(message),
        provider: (message) => new CalendarProviderError(message),
      },
    });
  }

  isConfigured(): boolean {
    return this.google.isConfigured();
  }

  authorizationUrl(state: string, loginHint?: string): string {
    return this.google.authorizationUrl(GOOGLE_CALENDAR_SCOPE, state, loginHint);
  }

  async exchange(code: string): Promise<CalendarGrant> {
    const grant = await this.google.exchangeCode(code);
    return {
      refreshToken: grant.refreshToken,
      account: accountOfIdToken(grant.idToken),
      scopes: grant.scopes,
    };
  }

  async listEvents(
    grant: CalendarReadGrant,
    range: { from: string; to: string; timeZone: string },
  ): Promise<ProviderEventsRead> {
    const buckets = googleBucketsOf(grant.connectionId);
    const { accessToken, idToken } = await this.google.accessToken(grant.refreshToken, buckets);
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
      const { response, errorBody } = await this.google.fetch(
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
    return { events, account: accountOfIdToken(idToken) };
  }

  async revoke(grant: CalendarReadGrant): Promise<void> {
    await this.google.revoke(grant.refreshToken, googleBucketsOf(grant.connectionId));
  }

  private config(key: 'googleApiBaseUrl'): string {
    return this.configService.getOrThrow<string>(`calendar.${key}`);
  }
}

function previousDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}
