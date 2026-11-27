import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { retryOnVersionConflict } from '@oppenheimer/backend-ddd';
import { PasswordResetDomainEvent } from '../../../auth/domain/events/password-reset.domain-event';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import type { HostPairingTokenRepositoryPort } from '../../database/host-pairing-token.repository.port';
import { HOST_PAIRING_TOKEN_REPOSITORY, HOST_REPOSITORY } from '../../hosts.di-tokens';

/** The fields of the event this handler reads, as the outbox delivers them. */
type PasswordReset = Pick<PasswordResetDomainEvent, 'userId' | 'resetAt'>;

/**
 * A password reset takes back the machines paired from an address nobody had
 * proven (`issuedVerified` false): a deployment that delivered no email when
 * they were paired let anyone who registered the address first pair one, and
 * the reset (or an administrator's set-password) is how the real owner takes
 * the account back. Hosts paired from a verified address stay, so a real
 * owner's reset costs them nothing.
 *
 * The unspent tokens go first, then the hosts, so a registration racing this
 * either spent its token before the revoke (and its host is found next) or
 * finds it revoked. Each host is unpaired as Remove host does, so
 * `HostUnpairedDomainEvent` stops its sessions and closes its link.
 *
 * Only what was minted up to the reset: the event is delivered at least once,
 * and a redelivery must not take a machine the owner paired afterwards.
 * Nothing is caught: a failure throws, and the outbox delivers the event again.
 */
@Injectable()
export class PasswordResetUnpairsHostsDomainEventHandler {
  private readonly logger = new Logger(PasswordResetUnpairsHostsDomainEventHandler.name);

  constructor(
    @Inject(HOST_PAIRING_TOKEN_REPOSITORY)
    private readonly tokens: HostPairingTokenRepositoryPort,
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  // `suppressErrors: false`: a failure is thrown for the outbox to retry; swallowed,
  // the event would be marked delivered with the credential still live.
  @OnEvent(PasswordResetDomainEvent.name, { suppressErrors: false })
  async handle(event: PasswordReset): Promise<void> {
    const resetAt = new Date(event.resetAt);
    const now = new Date();
    const revokedTokens = await this.tokens.revokeUnspentIssuedUnverified(
      event.userId,
      resetAt,
      now,
    );

    let unpaired = 0;
    for (const listed of await this.hosts.findPairedIssuedUnverifiedBySystem(
      event.userId,
      resetAt,
    )) {
      // Each try reads the host afresh, so one another writer changed since
      // the list was read is unpaired from what it is now.
      await retryOnVersionConflict(async () => {
        const found = await this.hosts.findOneByIdForMachine(listed.id);
        if (found.isNone() || found.unwrap().isUnpaired) return;
        const host = found.unwrap();
        host.unpair(now);
        await this.hosts.save(host);
        unpaired += 1;
      });
    }

    if (revokedTokens > 0 || unpaired > 0) {
      this.logger.log({
        message: 'Took back the hosts an unverified address paired, after a password reset',
        userId: event.userId,
        revokedTokens,
        unpaired,
      });
    }
  }
}
