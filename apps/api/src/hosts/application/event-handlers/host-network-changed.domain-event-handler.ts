import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { HostNetworkChangedDomainEvent } from '../../domain/events/host-network-changed.domain-event';

/** The fields of the event this handler reads, as the outbox delivers them. */
type ChangedNetwork = Pick<
  HostNetworkChangedDomainEvent,
  'id' | 'aggregateId' | 'ownerUserId' | 'hostName' | 'from' | 'to'
>;

/**
 * Tells the owner that a host connected from another country or network
 * operator (`networkMoveIsNotable`, decided 2026-09-26). The same kind of
 * notice as a pairing, for the same reason: a key used from somewhere its
 * owner never took the machine is what a stolen key looks like, and only the
 * owner can tell.
 *
 * Queued with the event id as the job id, joined with `-` (BullMQ reserves
 * `:`), so a redelivered event is not a second email.
 */
@Injectable()
export class HostNetworkChangedDomainEventHandler {
  private readonly logger = new Logger(HostNetworkChangedDomainEventHandler.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emails: Queue,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent(HostNetworkChangedDomainEvent.name)
  async handle(event: ChangedNetwork): Promise<void> {
    const url = this.frontendUrl;
    if (!url) {
      this.logger.warn({
        message: 'no frontend URL is configured; the new-network notice was not queued',
        hostId: event.aggregateId,
      });
      return;
    }
    const owner = await this.users.findOneById(event.ownerUserId);
    if (owner.isNone()) return;

    await this.emails.add(
      'host-network-changed',
      {
        to: owner.unwrap().email,
        userId: event.ownerUserId,
        hostId: event.aggregateId,
        hostName: event.hostName,
        // Not `from`/`to`: `to` is the recipient on every email job.
        fromNetwork: event.from,
        toNetwork: event.to,
        url,
      },
      { jobId: `host-network-changed-${event.id}` },
    );
    this.logger.log({ message: 'queued the new-network notice', hostId: event.aggregateId });
  }

  private get frontendUrl(): string | undefined {
    return this.configService.get<string>('app.frontendUrl') || undefined;
  }
}
