import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { MailErrors } from '../domain/mail.errors';

const STATE_PREFIX = 'mail:gmail-state:';
/** Long enough to read Google's consent screen; single use is the real control. */
const STATE_TTL_SECONDS = 900;

interface ConnectState {
  userId: string;
  organizationId: string;
}

/**
 * The OAuth `state` of Connect Gmail, the shape Connect GitHub's install
 * state has: minted when a person starts, echoed by Google on the redirect, redeemed
 * once by the person who started it in the workspace they started it in. Every
 * failure is the same `MAIL_005`.
 */
@Injectable()
export class GmailConnectStateResolver {
  constructor(private readonly cache: CacheService) {}

  async mint(userId: string, organizationId: string): Promise<{ state: string; expiresAt: Date }> {
    const state = randomBytes(32).toString('base64url');
    const stored = await this.cache.setIfAbsent<ConnectState>(
      `${STATE_PREFIX}${state}`,
      { userId, organizationId },
      STATE_TTL_SECONDS,
    );
    if (!stored) throw new AppError(MailErrors.GMAIL_STATE_REJECTED);
    return { state, expiresAt: new Date(Date.now() + STATE_TTL_SECONDS * 1000) };
  }

  async redeem(state: string, userId: string, organizationId: string): Promise<void> {
    const claim = await this.cache.take<ConnectState>(`${STATE_PREFIX}${state}`);
    if (!claim || claim.userId !== userId || claim.organizationId !== organizationId) {
      throw new AppError(MailErrors.GMAIL_STATE_REJECTED);
    }
  }
}
