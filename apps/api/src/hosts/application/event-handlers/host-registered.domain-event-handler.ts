import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import { HostRegisteredDomainEvent } from '../../domain/events/host-registered.domain-event';

/** The fields of the event this handler reads, as the outbox delivers them. */
type RegisteredHost = Pick<
  HostRegisteredDomainEvent,
  'aggregateId' | 'ownerUserId' | 'publicKeyFingerprint' | 'name' | 'hostname' | 'os'
>;

/**
 * Emails the owner that a machine was paired with their account: the one moment a
 * stolen registration token becomes a machine running work as that person, and only
 * the owner can tell their pairing from one they did not make (GitHub mails on a new
 * SSH key for the same reason). A security email, so always sent.
 *
 * Machine details come from the event; the only read is the owner's address.
 *
 * Queued with the host id as job id, so an outbox redelivery is not a second email.
 * The id is joined with `-`, never `:`: BullMQ reserves `:` for its own keys and
 * refuses a custom id containing it, and a refused add is an email never sent.
 */
@Injectable()
export class HostRegisteredDomainEventHandler {
  private readonly logger = new Logger(HostRegisteredDomainEventHandler.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emails: Queue,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent(HostRegisteredDomainEvent.name)
  async handle(event: RegisteredHost): Promise<void> {
    // Fail closed: a security notice whose button goes nowhere is worse than
    // none, and the log says why it was not sent.
    const url = this.frontendUrl;
    if (!url) {
      this.logger.warn({
        message: 'no frontend URL is configured; the new-host notice was not queued',
        hostId: event.aggregateId,
      });
      return;
    }
    const owner = await this.users.findOneById(event.ownerUserId);
    if (owner.isNone()) return;

    await this.emails.add(
      'host-paired',
      {
        to: owner.unwrap().email,
        userId: event.ownerUserId,
        hostId: event.aggregateId,
        hostName: event.name,
        hostname: event.hostname,
        os: event.os,
        fingerprint: event.publicKeyFingerprint,
        url,
      },
      { jobId: `host-paired-${event.aggregateId}` },
    );
    this.logger.log({ message: 'queued the new-host notice', hostId: event.aggregateId });
  }

  private get frontendUrl(): string | undefined {
    return this.configService.get<string>('app.frontendUrl') || undefined;
  }
}
