import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { AttachTicketFactory } from '../../application/attach-ticket.factory';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import { previewEnterUrl } from '../../domain/session-preview.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { IssueSessionPreviewCommand } from './issue-session-preview.command';

export interface IssuedSessionPreview {
  url: string;
  expiresAt: Date;
}

/**
 * Opens one of a session's ports for its Browser tab
 * (`product/versions/mvp/28-session-previews.md`): an attach ticket with the
 * `preview` target and the port, carried to the port's own preview origin,
 * which redeems it and keeps the reader in a cookie of its own.
 *
 * Judged as an attach is, here and again at every redemption and every
 * minute after: the session live, the person still a member who may use its
 * host. Whether the session listens on the port is the runner's answer, at
 * each connection; a ticket for a port nothing answers on opens a page that
 * says so.
 */
@CommandHandler(IssueSessionPreviewCommand)
export class IssueSessionPreviewCommandHandler
  implements ICommandHandler<IssueSessionPreviewCommand, IssuedSessionPreview>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    private readonly tickets: AttachTicketFactory,
    private readonly config: ConfigService,
  ) {}

  async execute(command: IssueSessionPreviewCommand): Promise<IssuedSessionPreview> {
    const base = this.previewBaseUrl;
    if (!base) throw new AppError(SessionErrors.PREVIEWS_NOT_CONFIGURED);
    const session = await this.loader.requireLive(command.scope, command.sessionId);
    await this.hosts.assertUsable(command.scope, session.hostId);

    const issued = await this.tickets.issue({
      sessionId: session.id,
      organizationId: session.organizationId,
      window: 0,
      userId: command.userId,
      target: 'preview',
      port: command.port,
    });
    return {
      url: previewEnterUrl(base, { sessionId: session.id, port: command.port }, issued.ticket, {
        path: command.path,
        embed: command.embed,
      }),
      expiresAt: issued.expiresAt,
    };
  }

  private get previewBaseUrl(): string | undefined {
    return this.config.get<string>('relay.previewBaseUrl');
  }
}
