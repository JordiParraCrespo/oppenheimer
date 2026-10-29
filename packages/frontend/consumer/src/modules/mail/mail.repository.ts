import { type GmailConnectionResponseDto, heyApiSdk } from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { GmailConnectionEntity } from './gmail-connection.entity';
import { MailErrors } from './mail.errors';

function toConnection(data: GmailConnectionResponseDto): GmailConnectionEntity {
  return new GmailConnectionEntity(
    data.id,
    data.accountEmail,
    data.label,
    data.status,
    data.connectedAt,
  );
}

/**
 * The reader's own Gmail accounts (`product/next-steps/mail.md`): connected
 * through Google's consent page, renamed, and disconnected. What the bots read
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
}
