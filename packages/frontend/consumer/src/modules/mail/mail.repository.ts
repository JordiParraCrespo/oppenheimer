import {
  type GmailConnectionResponseDto,
  heyApiSdk,
  type ScheduledMailResponseDto,
} from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
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
  findConnections(): Promise<GmailConnectionEntity[]> {
    return callApi(MailErrors.FETCH_CONNECTIONS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findGmailConnections());
      return data.map(toConnection);
    });
  }

  /** Google's consent page, for a new account or to reconnect one; the browser goes there. */
  startConnection(connectionId?: string): Promise<string> {
    return callApi(MailErrors.CONNECT_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.startGmailConnection({ body: connectionId ? { connectionId } : {} }),
      );
      return data.url;
    });
  }

  connect(code: string, state: string): Promise<GmailConnectionEntity> {
    return callApi(MailErrors.CONNECT_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.connectGmail({ body: { code, state } }));
      return toConnection(data);
    });
  }

  rename(id: string, label: string): Promise<GmailConnectionEntity> {
    return callApi(MailErrors.RENAME_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.updateGmailConnection({ path: { id }, body: { label } }),
      );
      return toConnection(data);
    });
  }

  disconnect(id: string): Promise<void> {
    return callApi(MailErrors.DISCONNECT_FAILED, async (api) => {
      await api.result(heyApiSdk.removeGmailConnection({ path: { id } }));
    });
  }

  findScheduled(): Promise<ScheduledMailEntity[]> {
    return callApi(MailErrors.FETCH_SCHEDULED_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findScheduledMail());
      return data.map(toScheduled);
    });
  }

  cancelScheduled(id: string): Promise<void> {
    return callApi(MailErrors.CANCEL_SCHEDULED_FAILED, async (api) => {
      await api.result(heyApiSdk.cancelScheduledMail({ path: { id } }));
    });
  }
}
