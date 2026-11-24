import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, type RefusalReader, UpstreamLimiter } from '@oppenheimer/backend-core';
import { SlackErrors } from '../domain/slack.errors';
import type { SlackIdentity } from '../domain/slack-account.entity';
import { isSlackFileUrl, slackUserName } from '../domain/slack-inbound.policy';
import type { SlackAppAccess, SlackPosted, SlackWebApiPort } from './slack-web-api.port';

const TIMEOUT_MS = 15_000;
/** A name looked up while Slack waits for its event's answer: short, or the id stands. */
const NAME_TIMEOUT_MS = 1_500;
/** How long a person's name is kept: a renamed person reads by their old name for up to a day. */
const NAME_TTL_SECONDS = 86_400;
/** How long an app Slack refused `users.info` for (made before it asked for `users:read`) is not asked again. */
const UNSCOPED_TTL_SECONDS = 3_600;
/** A reaction the turn waits on before it runs: short, so a slow Slack holds a turn up little. */
const REACTION_TIMEOUT_MS = 3_000;
/** What `reactions.add` and `reactions.remove` answer when the message already is as asked. */
const REACTION_SETTLED = new Set(['already_reacted', 'no_reaction']);
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
 *   second per channel, with bursts allowed; `auth.test` and `users.info`
 *   are Tier 4 (100+ a minute), `reactions.add` and `reactions.remove`
 *   Tier 3 (50+). The limiter keeps forty calls a minute per app, whatever
 *   the method.
 * - **How it says stop.** `429` with `Retry-After` in seconds; the limiter
 *   pauses the bucket and answers `SLACK_007`. Every other refusal is
 *   `200` with `{ ok: false, error }`.
 * - **What one job costs.** A turn posts its answer, and as it goes one post
 *   per run of tool calls: a handful a turn, one turn at a time per bot. Its
 *   start puts a reaction on and its answer takes it off: two calls a turn.
 *   An owner's message looks up each person it mentions (at most ten) once
 *   a day, and none for an app refused `users:read`, which is not asked
 *   again for an hour. Each family counts in its own bucket
 *   (`<app bucket>:users`, `<app bucket>:reactions`), as Slack counts per
 *   method, so neither can spend the forty posts a minute an answer needs.
 *   An image the owner shares is one download from the file host, at most
 *   four a message, in `<app bucket>:files`.
 */
@Injectable()
export class SlackWebApiGateway implements SlackWebApiPort {
  private readonly limiter: UpstreamLimiter;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly cache?: CacheService,
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

  async userName(access: SlackAppAccess, userId: string): Promise<string | null> {
    const unscoped = `slack:unscoped-names:${access.bucket}`;
    if (await this.cache?.get<boolean>(unscoped)) return null;
    const load = async () => (await this.lookUpName(access, userId)) ?? '';
    try {
      const name = this.cache
        ? await this.cache.getOrSet(`slack:name:${access.bucket}:${userId}`, NAME_TTL_SECONDS, load)
        : await load();
      return name || null;
    } catch (error) {
      if (error instanceof AppError && error.extensions.upstreamCode === 'missing_scope') {
        await this.cache?.set(unscoped, true, UNSCOPED_TTL_SECONDS);
      }
      throw error;
    }
  }

  private async lookUpName(access: SlackAppAccess, userId: string): Promise<string | null> {
    const users = { ...access, bucket: `${access.bucket}:users` };
    const body = await this.call(users, 'users.info', { user: userId }, 1, NAME_TIMEOUT_MS);
    return slackUserName(body.user);
  }

  async react(
    access: SlackAppAccess,
    message: { channel: string; ts: string; name: string },
    on: boolean,
  ): Promise<void> {
    const payload = { channel: message.channel, timestamp: message.ts, name: message.name };
    const reactions = { ...access, bucket: `${access.bucket}:reactions` };
    await this.call(
      reactions,
      on ? 'reactions.add' : 'reactions.remove',
      payload,
      1,
      REACTION_TIMEOUT_MS,
    ).catch((error: unknown) => {
      const code = error instanceof AppError ? error.extensions.upstreamCode : undefined;
      if (typeof code !== 'string' || !REACTION_SETTLED.has(code)) throw error;
    });
  }

  async download(access: SlackAppAccess, url: string, maxBytes: number): Promise<Buffer> {
    if (!isSlackFileUrl(url)) {
      throw new AppError(SlackErrors.UNAVAILABLE, { detail: 'Not a file on Slack’s file host' });
    }
    const files = `${access.bucket}:files`;
    // The body is read inside the limiter's slot, so a slot covers the whole download.
    const { response, errorBody } = await this.limiter
      .exchange(files, () => this.fetchFile(access, url, maxBytes), readRefusal)
      .catch((error: unknown) => {
        if (error instanceof AppError) throw error;
        throw new AppError(SlackErrors.UNAVAILABLE, {
          detail: `Slack did not hand over a file: ${error instanceof Error ? error.message : String(error)}`,
        });
      });
    if (errorBody !== null) {
      throw new AppError(SlackErrors.UNAVAILABLE, {
        detail: `Slack answered a file with ${response.status}`,
      });
    }
    if (!response.bytes) {
      throw new AppError(SlackErrors.UNAVAILABLE, { detail: `The file is over ${maxBytes} bytes` });
    }
    return response.bytes;
  }

  /** One file's answer, its bytes already read up to `maxBytes` (null past it) when it succeeded. */
  private async fetchFile(
    access: SlackAppAccess,
    url: string,
    maxBytes: number,
  ): Promise<FileAnswer> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${access.botToken}` },
      // A redirect would take the token, or a sign-in page, somewhere else.
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status >= 400) {
      return {
        status: response.status,
        headers: response.headers,
        text: () => response.text(),
        bytes: null,
      };
    }
    const declared = Number(response.headers.get('content-length') ?? '0');
    const bytes =
      declared > maxBytes ? await cancelled(response) : await readCapped(response, maxBytes);
    return { status: response.status, headers: response.headers, text: async () => '', bytes };
  }

  private async call(
    access: SlackAppAccess,
    method: string,
    payload: Record<string, unknown>,
    cost = 1,
    timeoutMs = TIMEOUT_MS,
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
            signal: AbortSignal.timeout(timeoutMs),
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

interface FileAnswer {
  status: number;
  headers: Headers;
  text(): Promise<string>;
  bytes: Buffer | null;
}

async function cancelled(response: Response): Promise<null> {
  await response.body?.cancel().catch(() => undefined);
  return null;
}

/** A response's body, read no further than `maxBytes`: null past it, the rest left unread. */
async function readCapped(response: Response, maxBytes: number): Promise<Buffer | null> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks);
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
}

function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
