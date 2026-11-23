import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, type RefusalReader, UpstreamLimiter } from '@oppenheimer/backend-core';
import { SlackErrors } from '../domain/slack.errors';
import type { SlackIdentity } from '../domain/slack-account.entity';
import type { SlackAppAccess, SlackPosted, SlackWebApiPort } from './slack-web-api.port';

const TIMEOUT_MS = 15_000;
/** A bot's answers come a few at a time; a burst past twenty waiting answers `SLACK_007`. */
const LIMITS = { maxInFlight: 8, maxQueued: 20, maxWaitMs: 5_000 };
/**
 * Below Slack's "about one message a second" for `chat.postMessage`, per app
 * and workspace, so a turn that writes as it goes never meets Slack's 429.
 */
const BUDGET = { units: 40, windowMs: 60_000 };

/** What Slack calls a token that will not work again: the app reads `revoked` until connected anew. */
const REFUSED_TOKEN = new Set([
  'invalid_auth',
  'not_authed',
  'account_inactive',
  'token_revoked',
  'token_expired',
  'no_permission',
  'missing_scope',
  'team_access_not_granted',
]);

/**
 * Slack's Web API (`https://api.slack.com/methods`), as a bot's own app, on
 * its bot token.
 *
 * The rate-limit budget:
 *
 * - **What is counted.** Calls per method, per app and workspace: the bucket
 *   is `app:<team id>:<bot user id>`. `auth.test`, made once per connect
 *   before Slack has named the app, is bucketed by the token's last
 *   characters (`connect:<hint>`) and spends no budget.
 * - **The windows.** `chat.postMessage` is "special": about one message a
 *   second per channel, with bursts allowed; `auth.test` is Tier 4 (100+ a
 *   minute). The limiter keeps forty posts a minute per app.
 * - **How it says stop.** `429` with `Retry-After` in seconds; the limiter
 *   pauses the bucket and answers `SLACK_007`. Every other refusal is
 *   `200` with `{ ok: false, error }`.
 * - **What one job costs.** A turn posts its answer, and as it goes one post
 *   per run of tool calls: a handful a turn, one turn at a time per bot.
 */
@Injectable()
export class SlackWebApiGateway implements SlackWebApiPort {
  private readonly limiter: UpstreamLimiter;

  constructor(
    private readonly configService: ConfigService,
    @Optional() cache?: CacheService,
  ) {
    this.limiter = new UpstreamLimiter('Slack', SlackErrors.RATE_LIMITED, cache, {
      ...LIMITS,
      budget: BUDGET,
    });
  }

  async identify(botToken: string): Promise<SlackIdentity> {
    const body = await this.call(
      { botToken, bucket: `connect:${botToken.slice(-4)}` },
      'auth.test',
      {},
      0,
    );
    const teamId = stringOf(body.team_id);
    const botUserId = stringOf(body.user_id);
    if (!teamId || !botUserId || !stringOf(body.bot_id)) {
      throw new AppError(SlackErrors.TOKEN_REFUSED, {
        detail: 'That token is not a bot token: use the Bot User OAuth Token (xoxb-…).',
      });
    }
    return {
      teamId,
      teamName: (stringOf(body.team) ?? teamId).slice(0, 200),
      botUserId,
      botName: (stringOf(body.user) ?? botUserId).slice(0, 200),
    };
  }

  async post(
    access: SlackAppAccess,
    message: { channel: string; text: string; threadTs: string | null },
  ): Promise<SlackPosted> {
    const body = await this.call(access, 'chat.postMessage', {
      channel: message.channel,
      text: message.text,
      ...(message.threadTs ? { thread_ts: message.threadTs } : {}),
      // Links stay links; a bot's answer unfurling a preview of each is noise in a thread.
      unfurl_links: false,
      unfurl_media: false,
    });
    return { channel: stringOf(body.channel) ?? message.channel, ts: stringOf(body.ts) ?? '' };
  }

  private async call(
    access: SlackAppAccess,
    method: string,
    payload: Record<string, unknown>,
    cost = 1,
  ): Promise<Record<string, unknown>> {
    const url = `${this.configService.get<string>('slack.apiUrl') ?? 'https://slack.com/api'}/${method}`;
    const { response, errorBody } = await this.limiter
      .exchange(
        access.bucket,
        () =>
          fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${access.botToken}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }),
        readRefusal,
        cost,
      )
      .catch((error: unknown) => {
        if (error instanceof AppError) throw error;
        throw new AppError(SlackErrors.UNAVAILABLE, {
          detail: `Slack did not answer ${method}: ${error instanceof Error ? error.message : String(error)}`,
        });
      });
    if (errorBody !== null) {
      throw new AppError(SlackErrors.UNAVAILABLE, {
        detail: `Slack answered ${method} with ${response.status}`,
      });
    }
    const body = recordOf(await response.json().catch(() => null));
    if (body.ok === true) return body;
    const error = stringOf(body.error) ?? 'unknown_error';
    if (REFUSED_TOKEN.has(error)) {
      throw new AppError(SlackErrors.TOKEN_REFUSED, {
        detail: `Slack refused the bot token: ${error}`,
        extensions: { upstreamCode: error },
      });
    }
    throw new AppError(SlackErrors.UNAVAILABLE, {
      detail: `Slack refused ${method}: ${error}`,
      extensions: { upstreamCode: error },
    });
  }
}

/** A `429` and its `Retry-After` are read by the limiter; a body's `ratelimited` error is the same refusal. */
const readRefusal: RefusalReader = (body) => ({
  limited: /"error"\s*:\s*"ratelimited"/.test(body),
});

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
