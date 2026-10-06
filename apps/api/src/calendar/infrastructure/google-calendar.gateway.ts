import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type CalendarGrant,
  CalendarGrantRevokedError,
  CalendarProviderError,
  type CalendarProviderPort,
  GOOGLE_CALENDAR_SCOPE,
  type ProviderCalendarEvent,
} from './calendar-provider.port';
import { emailOfIdToken, googleEventsToProvider, nextDay } from './google-calendar-event.util';

/** A page is 2 500 events at most; a month of anyone's calendar fits in one or two. */
const PAGE_SIZE = 2500;
const MAX_PAGES = 4;
const TIMEOUT_MS = 10_000;

/**
 * Google Calendar, read-only, through the same OAuth client as Google sign-in. The
 * redirect lands on the console (`/plan/calendar/google`), which posts the code back,
 * as Connect GitHub does; so the redirect URI is the console's.
 */
@Injectable()
export class GoogleCalendarGateway implements CalendarProviderPort {
  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  authorizationUrl(state: string): string {
    const url = new URL(this.config('googleAuthUrl'));
    url.searchParams.set('client_id', this.clientId ?? '');
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', `openid email ${GOOGLE_CALENDAR_SCOPE}`);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchange(code: string): Promise<CalendarGrant> {
    const body = await this.token({
      code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
    const accountEmail = emailOfIdToken(body.id_token);
    if (!accountEmail) throw new CalendarProviderError('Google returned no account email');
    return {
      refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
      accountEmail,
      scopes: typeof body.scope === 'string' ? body.scope.split(' ') : [],
    };
  }

  async listEvents(
    refreshToken: string,
    range: { from: string; to: string; timeZone: string },
  ): Promise<ProviderCalendarEvent[]> {
    const accessToken = await this.accessToken(refreshToken);
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
      const response = await this.fetch(url, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401) throw new CalendarGrantRevokedError('Google refused the token');
      if (!response.ok) throw new CalendarProviderError(`Google answered ${response.status}`);
      const body = (await response.json()) as { nextPageToken?: unknown };
      events.push(...googleEventsToProvider(body, range));
      pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : undefined;
      if (!pageToken) break;
    }
    return events;
  }

  async revoke(refreshToken: string): Promise<void> {
    const url = new URL(`${this.config('googleOauthBaseUrl')}/revoke`);
    url.searchParams.set('token', refreshToken);
    await this.fetch(url, { method: 'POST' }).catch(() => undefined);
  }

  private async accessToken(refreshToken: string): Promise<string> {
    const body = await this.token({ refresh_token: refreshToken, grant_type: 'refresh_token' });
    if (typeof body.access_token !== 'string') {
      throw new CalendarProviderError('Google returned no access token');
    }
    return body.access_token;
  }

  /** Google's token endpoint. `invalid_grant` is a grant that is gone, not a fault. */
  private async token(fields: Record<string, string>): Promise<Record<string, unknown>> {
    const response = await this.fetch(new URL(`${this.config('googleOauthBaseUrl')}/token`), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId ?? '',
        client_secret: this.clientSecret ?? '',
        ...fields,
      }).toString(),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.error === 'invalid_grant') throw new CalendarGrantRevokedError('invalid_grant');
    if (!response.ok)
      throw new CalendarProviderError(`Google token endpoint answered ${response.status}`);
    return body;
  }

  private async fetch(url: URL, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
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
