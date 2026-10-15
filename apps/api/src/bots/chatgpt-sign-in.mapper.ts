import { Injectable } from '@nestjs/common';
import type { ChatgptLoginFlow } from './domain/chatgpt-login.policy';
import {
  ChatgptLoginResponseDto,
  ChatgptLoginStatusResponseDto,
} from './dtos/chatgpt-login.response.dto';
import type { ChatgptDeviceCode, ChatgptTokens } from './infrastructure/chatgpt-auth.port';

/** The fields of a JSON object, or none. */
function recordOf(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringsOf<K extends string>(
  record: Record<string, unknown>,
  keys: readonly K[],
): Record<K, string> | null {
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string' || value.length === 0) return null;
    out[key] = value;
  }
  return out;
}

/**
 * The shapes a ChatGPT sign-in takes (`product/versions/mvp/25-bots.md` §2):
 * what its credential seals in place of a key, what a sign-in in progress
 * seals into its `flowId`, and what the console is answered. The general
 * credential mapper knows nothing of them; a credential row only ever holds
 * the sealed bytes.
 */
@Injectable()
export class ChatgptSignInMapper {
  /**
   * What a ChatGPT credential seals in place of a key: the sign-in's tokens as
   * one JSON text, the expiry in epoch milliseconds.
   */
  toSecret(tokens: ChatgptTokens): string {
    return JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.getTime(),
      accountId: tokens.accountId,
    });
  }

  /** The tokens a ChatGPT credential's opened secret holds; null for one that is not that shape. */
  tokensOf(secret: string): ChatgptTokens | null {
    const record = recordOf(secret);
    const strings = stringsOf(record, ['accessToken', 'refreshToken', 'accountId'] as const);
    if (!strings || typeof record.expiresAt !== 'number') return null;
    return { ...strings, expiresAt: new Date(record.expiresAt) };
  }

  /** A sign-in in progress as the text that is sealed into its `flowId`. */
  toLoginFlow(flow: ChatgptLoginFlow): string {
    return JSON.stringify({
      deviceAuthId: flow.deviceAuthId,
      userCode: flow.userCode,
      organizationId: flow.organizationId,
      expiresAt: flow.expiresAt.getTime(),
      intervalSeconds: flow.intervalSeconds,
    });
  }

  /** The sign-in an opened `flowId` holds; null for text that is not one. */
  loginFlowOf(text: string): ChatgptLoginFlow | null {
    const record = recordOf(text);
    const strings = stringsOf(record, ['deviceAuthId', 'userCode', 'organizationId'] as const);
    const { expiresAt, intervalSeconds } = record;
    if (!strings || typeof expiresAt !== 'number') return null;
    if (typeof intervalSeconds !== 'number' || !(intervalSeconds > 0)) return null;
    return { ...strings, expiresAt: new Date(expiresAt), intervalSeconds };
  }

  /** What the console gets to show a started sign-in: never the device code's own id, except sealed. */
  toLoginResponse(
    flowId: string,
    code: ChatgptDeviceCode,
    expiresAt: Date,
  ): ChatgptLoginResponseDto {
    const dto = new ChatgptLoginResponseDto();
    dto.flowId = flowId;
    dto.userCode = code.userCode;
    dto.verificationUrl = code.verificationUrl;
    dto.intervalSeconds = code.intervalSeconds;
    dto.expiresAt = expiresAt.toISOString();
    return dto;
  }

  toLoginStatusResponse(connected: boolean): ChatgptLoginStatusResponseDto {
    const dto = new ChatgptLoginStatusResponseDto();
    dto.status = connected ? 'connected' : 'pending';
    return dto;
  }
}
