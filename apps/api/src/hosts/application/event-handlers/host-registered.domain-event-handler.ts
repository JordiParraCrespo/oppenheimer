import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { USER_REPOSITORY } from '../../../users/user.di-tokens';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostRegisteredDomainEvent } from '../../domain/events/host-registered.domain-event';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';

/** The fields of the event this handler reads, as the outbox delivers them. */
type RegisteredHost = Pick<
  HostRegisteredDomainEvent,
  'aggregateId' | 'ownerUserId' | 'publicKeyFingerprint'
>;

/**
 * Tells the owner, by email, that a machine was paired with their account.
 *
 * Pairing is the one moment a stolen registration token turns into a machine
 * that can run work as that person, and the owner is the only one who can tell
 * a pairing they made from one they did not. GitHub mails you when an SSH key
 * is added for the same reason. It is a security email, so it is always sent.
 *
 * Queued with the host id as the job id: the outbox redelivers an event whose
 * handler failed, and a second delivery must not be a second email.
 */
@Injectable()
export class HostRegisteredDomainEventHandler {
  private readonly logger = new Logger(HostRegisteredDomainEventHandler.name);

  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emails: Queue,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent(HostRegisteredDomainEvent.name)
  async handle(event: RegisteredHost): Promise<void> {
    const owner = await this.users.findOneById(event.ownerUserId);
    if (owner.isNone()) return;
    const host = await this.hosts.findOneByIdForMachine(event.aggregateId);
    if (host.isNone()) return;
    const machine = host.unwrap();

    await this.emails.add(
      'host-paired',
      {
        to: owner.unwrap().email,
        userId: event.ownerUserId,
        hostName: machine.name,
        machine: [machine.hostname, machine.os].filter(Boolean).join(', ') || 'unknown machine',
        fingerprint: event.publicKeyFingerprint,
        url: this.frontendUrl,
      },
      { jobId: `host-paired:${event.aggregateId}` },
    );
    this.logger.log({ message: 'queued the new-host notice', hostId: event.aggregateId });
  }

  private get frontendUrl(): string {
    return this.configService.get<string>('app.frontendUrl') ?? '';
  }
}
