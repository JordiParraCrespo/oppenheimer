import { Injectable, Optional } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError, type RefusalReader, UpstreamLimiter } from '@oppenheimer/backend-core';
import { BotErrors } from '../domain/bots.errors';
import {
  type ChatgptAuthPort,
  ChatgptAuthRefusedError,
  type ChatgptDeviceCode,
  type ChatgptDevicePoll,
  type ChatgptTokens,
} from './chatgpt-auth.port';
import { chatgptTokensOf, jsonOf } from './chatgpt-token.util';

/** OpenAI's sign-in server, and the Codex CLI's public client on it. */
const ISSUER = 'https://auth.openai.com';
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
/** Where a device code's authorization code is redeemed: the device flow's own callback. */
const DEVICE_REDIRECT_URI = `${ISSUER}/deviceauth/callback`;
const DEFAULT_INTERVAL_SECONDS = 5;
const TIMEOUT_MS = 10_000;
/**
 * A sign-in is one device code and a poll every five seconds while the
 * dialog is open (a few dozen calls at most), and a turn refreshes its token
 * once every few days. Four in flight per process is plenty; past twenty
 * waiting a call answers `BOTS_017` rather than hanging.
 */
const LIMITS = { maxInFlight: 4, maxQueued: 20, maxWaitMs: 5_000 };
/** OpenAI does not publish this server's limits; all of it is one client, so one bucket. */
const CLIENT_BUCKET = 'client';

/** The poll's answers that mean "not approved yet", as the Codex CLI reads them. */
const PENDING_STATUSES = new Set([403, 404]);

/** A 429, or a body naming a rate limit, pauses the one bucket. */
const readRateRefusal: RefusalReader = (errorBody) => {
  const error = jsonOf(errorBody).error;
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : error;
  return { limited: code === 'rate_limit_exceeded' || code === 'too_many_requests' };
};

/**
 * Signing in to ChatGPT as the Codex CLI does (`codex login --device-auth`):
 * a device code from `/api/accounts/deviceauth/usercode`, polled at
 * `/deviceauth/token` until the person approves it, whose answer is an
 * authorization code and its PKCE verifier to redeem at `/oauth/token`.
 * Refreshing is `/oauth/token` again, and rotates the refresh token.
 *
 * Every call goes through one {@link UpstreamLimiter} (`.agents/rules/integrations.md`):
 * OpenAI counts the client, so there is one bucket, and a refusal for rate
 * pauses it on every replica and answers `BOTS_017`.
 */
@Injectable()
export class OpenAiChatgptAuthAdapter implements ChatgptAuthPort {
  private readonly limiter: UpstreamLimiter;

  constructor(@Optional() cache?: CacheService) {
    this.limiter = new UpstreamLimiter(
      'ChatGPT sign-in',
      BotErrors.CHATGPT_RATE_LIMITED,
      cache,
      LIMITS,
    );
  }

  async requestDeviceCode(): Promise<ChatgptDeviceCode> {
    const { body, refused } = await this.post('/api/accounts/deviceauth/usercode', {
      json: { client_id: CLIENT_ID },
    });
    if (refused) throw new AppError(BotErrors.CHATGPT_UNREACHABLE, { detail: refused });
    const deviceAuthId = body.device_auth_id;
    const userCode = body.user_code ?? body.usercode;
    if (typeof deviceAuthId !== 'string' || typeof userCode !== 'string') {
      throw new AppError(BotErrors.CHATGPT_UNREACHABLE, { detail: 'No device code in the answer' });
    }
    const interval = Number.parseInt(String(body.interval ?? ''), 10);
    return {
      deviceAuthId,
      userCode,
      verificationUrl: `${ISSUER}/codex/device`,
      intervalSeconds:
        Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_INTERVAL_SECONDS,
    };
  }

  async pollDeviceCode({
    deviceAuthId,
    userCode,
  }: Pick<ChatgptDeviceCode, 'deviceAuthId' | 'userCode'>): Promise<ChatgptDevicePoll> {
    const { body, status, refused } = await this.post('/api/accounts/deviceauth/token', {
      json: { device_auth_id: deviceAuthId, user_code: userCode },
    });
    if (refused && PENDING_STATUSES.has(status)) return { status: 'pending' };
    if (refused) throw new AppError(BotErrors.CHATGPT_UNREACHABLE, { detail: refused });
    const { authorization_code: code, code_verifier: verifier } = body;
    if (typeof code !== 'string' || typeof verifier !== 'string') {
      throw new AppError(BotErrors.CHATGPT_UNREACHABLE, {
        detail: 'No authorization code in the answer',
      });
    }
    const tokens = await this.token({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: DEVICE_REDIRECT_URI,
    });
    return { status: 'authorized', tokens };
  }

  refresh(refreshToken: string): Promise<ChatgptTokens> {
    return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  /** `/oauth/token`: a 4xx is a refusal to sign in again over, anything else ChatGPT being unreachable. */
  private async token(fields: Record<string, string>): Promise<ChatgptTokens> {
    const { body, status, refused } = await this.post('/oauth/token', {
      form: { client_id: CLIENT_ID, ...fields },
    });
    if (refused && status >= 400 && status < 500) throw new ChatgptAuthRefusedError(refused);
    if (refused) throw new AppError(BotErrors.CHATGPT_UNREACHABLE, { detail: refused });
    const tokens = chatgptTokensOf(body, Date.now());
    if (!tokens) {
      throw new AppError(BotErrors.CHATGPT_UNREACHABLE, {
        detail: 'The token answer is missing a part',
      });
    }
    return tokens;
  }

  /**
   * Every call, through the limiter. The rate-limit problem (`BOTS_017`)
   * passes through; a refusal comes back as its status and a line that says
   * it without echoing the body, which may hold a token.
   */
  private async post(
    path: string,
    payload: { json: Record<string, string> } | { form: Record<string, string> },
  ): Promise<{ body: Record<string, unknown>; status: number; refused: string | null }> {
    const init: RequestInit =
      'json' in payload
        ? {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload.json),
          }
        : {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload.form).toString(),
          };
    try {
      const { response, errorBody } = await this.limiter.exchange(
        [CLIENT_BUCKET],
        () => fetch(`${ISSUER}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }),
        readRateRefusal,
      );
      if (errorBody !== null) {
        return {
          body: {},
          status: response.status,
          refused: `${path} answered ${response.status}`,
        };
      }
      return { body: jsonOf(await response.text()), status: response.status, refused: null };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(BotErrors.CHATGPT_UNREACHABLE, {
        detail: error instanceof Error ? error.message : 'ChatGPT unreachable',
      });
    }
  }
}
