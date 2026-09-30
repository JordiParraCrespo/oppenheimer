import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { GithubErrors } from '../domain/github.errors';

export const INSTALL_STATE_PREFIX = 'github:install-state:';
/**
 * Fifteen minutes. The reader may spend a while on GitHub's repository picker,
 * and single use is the real control — the lifetime only bounds how long a
 * state nobody redeemed lingers.
 */
export const INSTALL_STATE_TTL_SECONDS = 900;

interface InstallState {
  userId: string;
  organizationId: string;
}

export interface MintedInstallState {
  state: string;
  expiresAt: Date;
}

/**
 * The OAuth `state` of a GitHub App install: minted when a person starts one,
 * echoed back by GitHub on the redirect, redeemed by `POST /installations`.
 * The redirect's `code` binds the claim to a GitHub account, not to the
 * console user whose browser posts it; the state ties it to an install this
 * person started, in this workspace, so a half-finished callback URL cannot
 * connect someone's installation to whoever opens it.
 *
 * A Redis key, not a table: a quarter-hour life earns no row. Minted with
 * `SET … NX` and redeemed with an atomic read-and-delete, so it is single use.
 */
@Injectable()
export class InstallStateResolver {
  constructor(private readonly cache: CacheService) {}

  async mint(userId: string, organizationId: string): Promise<MintedInstallState> {
    // 32 bytes of `node:crypto`, base64url: unguessable, URL-safe, and free of
    // the `.` the console splits its walk prefix on.
    const state = randomBytes(32).toString('base64url');
    const stored = await this.cache.setIfAbsent<InstallState>(
      `${INSTALL_STATE_PREFIX}${state}`,
      { userId, organizationId },
      INSTALL_STATE_TTL_SECONDS,
    );
    // Only a collision on 256 random bits gets here.
    if (!stored) throw new AppError(GithubErrors.INSTALL_STATE_REJECTED);
    return { state, expiresAt: new Date(Date.now() + INSTALL_STATE_TTL_SECONDS * 1000) };
  }

  /**
   * Consumes `state`, and throws unless it was minted for exactly this person
   * in this workspace. The key is spent even on a mismatch, so a wrong guess
   * cannot be retried against it; and every failure is the same `GITHUB_011`,
   * with no detail saying which.
   */
  async redeem(state: string, userId: string, organizationId: string): Promise<void> {
    const claim = await this.cache.take<InstallState>(`${INSTALL_STATE_PREFIX}${state}`);
    if (!claim || claim.userId !== userId || claim.organizationId !== organizationId) {
      throw new AppError(GithubErrors.INSTALL_STATE_REJECTED);
    }
  }
}
