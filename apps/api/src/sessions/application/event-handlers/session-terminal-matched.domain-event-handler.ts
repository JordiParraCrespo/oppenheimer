import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { SessionTerminalWatchRepositoryPort } from '../../database/session-terminal-watch.repository.port';
import { SessionTerminalMatchedDomainEvent } from '../../domain/events/session-terminal-matched.domain-event';
import { SESSION_TERMINAL_WATCH_REPOSITORY } from '../../sessions.di-tokens';

/**
 * Keeps a terminal watch's newest count (`27-bot-subscriptions.md` §2), so
 * the watch sent again after a runner restart counts on from it. Recording
 * never lowers the count, so a redelivered or late report is harmless.
 */
@Injectable()
export class SessionTerminalMatchedDomainEventHandler {
  constructor(
    @Inject(SESSION_TERMINAL_WATCH_REPOSITORY)
    private readonly watches: SessionTerminalWatchRepositoryPort,
  ) {}

  @OnEvent(SessionTerminalMatchedDomainEvent.name, { suppressErrors: false })
  async record(
    event: Pick<SessionTerminalMatchedDomainEvent, 'organizationId' | 'watchId' | 'count'>,
  ): Promise<void> {
    await this.watches.recordMatches(event.organizationId, event.watchId, event.count);
  }
}
