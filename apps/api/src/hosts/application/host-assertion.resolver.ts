import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import type { HostRepositoryPort } from '../database/host.repository.port';
import { HostErrors } from '../domain/hosts.errors';
import { HOST_REPOSITORY } from '../hosts.di-tokens';
import {
  assertionIsSignedBy,
  type DecodedHostAssertion,
  decodeHostAssertion,
  looksLikeHostAssertion,
} from '../infrastructure/host-assertion.util';
import type { HostAssertionPort, HostPrincipalIdentity } from './host-assertion.port';

/**
 * The longest a boot assertion may live. The runner mints one per dial with a
 * five-minute expiry (`BootTokenTTL`), so anything claiming more than that was
 * not minted by a runner this control plane knows how to talk to.
 *
 * The lifetime is left where the runner put it rather than shortened, because
 * the replay guard below is what refuses a captured token — a shorter window
 * would only fail a slow dial from a phone tethering a laptop.
 */
const MAX_LIFETIME_SECONDS = 5 * 60;

/** Clock skew tolerated on the expiry, in seconds. */
const CLOCK_SKEW_SECONDS = 30;

/** Namespace of the burned-`jti` markers in Redis. */
const REPLAY_KEY_PREFIX = 'host-assertion:jti';

/**
 * Verifies a runner's boot assertion.
 *
 * Four things have to hold, and a failure of any of them produces one answer:
 *
 * 1. it is a compact EdDSA JWS whose `iss` and `sub` are the same host id — the
 *    runner issues its own credential, so anything else is a different scheme;
 * 2. the audience is this control plane, so an assertion minted for another
 *    deployment cannot be replayed here;
 * 3. it has not expired and does not claim a longer life than a boot token has;
 * 4. its `jti` has not been seen before.
 *
 * The fourth is why this is not a pure function. A captured assertion cannot
 * *read* anything — job payloads are sealed to the host's key — but it could open
 * a link and inject events into a session's log, which is the source of truth.
 * One atomic set-if-absent, with the token's own remaining lifetime as the TTL,
 * closes that.
 */
@Injectable()
export class HostAssertionResolver implements HostAssertionPort {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {}

  recognises(bearer: string): boolean {
    return looksLikeHostAssertion(bearer);
  }

  async verify(assertion: string): Promise<HostPrincipalIdentity> {
    const decoded = decodeHostAssertion(assertion);
    if (!decoded) throw this.rejected('not a compact EdDSA assertion');

    const now = new Date();
    const hostId = this.subjectOf(decoded);
    const jti = stringClaim(decoded.claims.jti);
    if (!jti) throw this.rejected('no token id to burn');

    const expiresAt = this.expiryOf(decoded, now);
    if (!this.audienceMatches(decoded)) throw this.rejected('a different control plane');

    const found = await this.hosts.findOneByIdForMachine(hostId);
    if (found.isNone()) throw this.rejected('no such host');

    const host = found.unwrap();
    // Either key is this host: during a rotation window the old one is still
    // valid, because a runner switches only once the new key is acknowledged.
    if (!assertionIsSignedBy(decoded, host.keysValidAt(now))) {
      throw this.rejected('not signed by this host');
    }

    await this.burn(hostId, jti, expiresAt, now);

    return { hostId };
  }

  /**
   * `iss` and `sub` must agree: the runner is both the issuer and the subject of
   * its own credential, and a token where they differ is describing some other
   * relationship than "this host is calling".
   */
  private subjectOf(decoded: DecodedHostAssertion): string {
    const subject = stringClaim(decoded.claims.sub);
    const issuer = stringClaim(decoded.claims.iss);
    if (!subject || subject !== issuer) throw this.rejected('issuer and subject disagree');
    return subject;
  }

  private expiryOf(decoded: DecodedHostAssertion, now: Date): Date {
    const exp = numberClaim(decoded.claims.exp);
    if (exp === null) throw this.rejected('no expiry');

    const expiresAt = new Date(exp * 1000);
    const secondsLeft = (expiresAt.getTime() - now.getTime()) / 1000;
    if (secondsLeft <= -CLOCK_SKEW_SECONDS) throw this.rejected('expired');
    // A token claiming a longer life than a boot token has was minted by
    // something else, and accepting it would silently widen the replay window
    // the burn below is sized against.
    if (secondsLeft > MAX_LIFETIME_SECONDS + CLOCK_SKEW_SECONDS) {
      throw this.rejected('lives longer than a boot token');
    }
    return expiresAt;
  }

  /**
   * The audience is compared against the configured control-plane URL with
   * trailing slashes ignored, because the runner stores whatever URL it was
   * registered with and `https://api.example.com/` is the same deployment as
   * `https://api.example.com`.
   */
  private audienceMatches(decoded: DecodedHostAssertion): boolean {
    const expected = this.controlPlaneUrl;
    const audience = decoded.claims.aud;
    const values = Array.isArray(audience) ? audience : [audience];
    return values.some((value) => {
      const candidate = stringClaim(value);
      return candidate !== null && candidate.replace(/\/+$/, '') === expected;
    });
  }

  /**
   * Claim the `jti` for the rest of the token's life. Losing the race means the
   * assertion has already been used, which is a replay whether or not the first
   * use was legitimate.
   */
  private async burn(hostId: string, jti: string, expiresAt: Date, now: Date): Promise<void> {
    const ttlSeconds = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - now.getTime()) / 1000) + CLOCK_SKEW_SECONDS,
    );
    const claimed = await this.cache.setIfAbsent(
      `${REPLAY_KEY_PREFIX}:${hostId}:${jti}`,
      now.toISOString(),
      ttlSeconds,
    );
    if (!claimed) throw this.rejected('already used');
  }

  private get controlPlaneUrl(): string {
    return (this.configService.get<string>('hosts.controlPlaneUrl') ?? '').replace(/\/+$/, '');
  }

  /**
   * One problem document for every failure. The reason is a `detail` for the
   * operator reading a log, never a branch a caller can take: telling a caller
   * which check refused it is telling them what to change.
   */
  private rejected(reason: string): AppError {
    return new AppError(HostErrors.ASSERTION_REJECTED, { detail: reason });
  }
}

function stringClaim(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberClaim(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
