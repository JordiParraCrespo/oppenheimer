import {
  type GmailConnectionResponseDto,
  heyApiSdk,
  type ScheduledMailResponseDto,
} from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { GmailConnectionEntity } from './gmail-connection.entity';
import { MailErrors } from './mail.errors';
import { ScheduledMailEntity } from './scheduled-mail.entity';

function toConnection(data: GmailConnectionResponseDto): GmailConnectionEntity {
  return new GmailConnectionEntity(
    data.id,
    data.accountEmail,
    data.label,
    data.status,
    data.connectedAt,
  );
}

function toScheduled(data: ScheduledMailResponseDto): ScheduledMailEntity {
  return new ScheduledMailEntity(
    data.id,
    data.accountEmail,
    data.recipients,
    data.subject,
    new Date(data.scheduledFor),
    data.botId,
  );
}

/**
 * The reader's own Gmail accounts (`product/next-steps/mail.md`): connected
 * through Google's consent page, renamed, and disconnected; and the mail their
 * bots scheduled, which can be cancelled until it goes. What the bots read
 * from them never passes through the console.
 */
@injectable()
export class MailRepository {
  @MapApiError(MailErrors.FETCH_CONNECTIONS_FAILED)
  async findConnections(): Promise<GmailConnectionEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findGmailConnections(),
      MailErrors.FETCH_CONNECTIONS_FAILED,
    );
    return data.map(toConnection);
  }

  /** Google's consent page, for a new account or to reconnect one; the browser goes there. */
  @MapApiError(MailErrors.CONNECT_FAILED)
  async startConnection(connectionId?: string): Promise<string> {
    const data = await unwrapBody(
      heyApiSdk.startGmailConnection({ body: connectionId ? { connectionId } : {} }),
      MailErrors.CONNECT_FAILED,
    );
    return data.url;
  }

  @MapApiError(MailErrors.CONNECT_FAILED)
  async connect(code: string, state: string): Promise<GmailConnectionEntity> {
    const data = await unwrapBody(
      heyApiSdk.connectGmail({ body: { code, state } }),
      MailErrors.CONNECT_FAILED,
    );
    return toConnection(data);
  }

  @MapApiError(MailErrors.RENAME_FAILED)
  async rename(id: string, label: string): Promise<GmailConnectionEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateGmailConnection({ path: { id }, body: { label } }),
      MailErrors.RENAME_FAILED,
    );
    return toConnection(data);
  }

  @MapApiError(MailErrors.DISCONNECT_FAILED)
  async disconnect(id: string): Promise<void> {
    await unwrap(heyApiSdk.removeGmailConnection({ path: { id } }), MailErrors.DISCONNECT_FAILED);
  }

  @MapApiError(MailErrors.FETCH_SCHEDULED_FAILED)
  async findScheduled(): Promise<ScheduledMailEntity[]> {
    const data = await unwrapBody(heyApiSdk.findScheduledMail(), MailErrors.FETCH_SCHEDULED_FAILED);
    return data.map(toScheduled);
  }

  @MapApiError(MailErrors.CANCEL_SCHEDULED_FAILED)
  async cancelScheduled(id: string): Promise<void> {
    await unwrap(
      heyApiSdk.cancelScheduledMail({ path: { id } }),
      MailErrors.CANCEL_SCHEDULED_FAILED,
    );
  }
}
