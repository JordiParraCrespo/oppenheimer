import { heyApiSdk, type WhatsappAccountResponseDto } from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { WhatsappErrors } from './whatsapp.errors';
import { WhatsappAccountEntity } from './whatsapp-account.entity';

function toAccount(data: WhatsappAccountResponseDto): WhatsappAccountEntity {
  return new WhatsappAccountEntity(
    data.id,
    data.hostId,
    data.label,
    data.status,
    data.hostOnline,
    data.phone ?? null,
    data.displayName ?? null,
    data.qr ?? null,
    data.qrExpiresAt ? new Date(data.qrExpiresAt) : null,
    data.statusReason ?? null,
    data.linkedAt,
  );
}

/**
 * The reader's own WhatsApp numbers (`product/next-steps/whatsapp.md`): linked
 * on one of their hosts by scanning a QR code, paired again, and unlinked.
 * What their bots read and send there never passes through the console.
 */
@injectable()
export class WhatsappRepository {
  @MapApiError(WhatsappErrors.FETCH_ACCOUNTS_FAILED)
  async findAccounts(): Promise<WhatsappAccountEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findWhatsappAccounts(),
      WhatsappErrors.FETCH_ACCOUNTS_FAILED,
    );
    return data.map(toAccount);
  }

  /** Links a number on a host, or pairs the reader's number there again. */
  @MapApiError(WhatsappErrors.LINK_FAILED)
  async link(hostId: string, label?: string): Promise<WhatsappAccountEntity> {
    const data = await unwrapBody(
      heyApiSdk.linkWhatsapp({ body: { hostId, ...(label ? { label } : {}) } }),
      WhatsappErrors.LINK_FAILED,
    );
    return toAccount(data);
  }

  @MapApiError(WhatsappErrors.UNLINK_FAILED)
  async unlink(id: string): Promise<void> {
    await unwrap(heyApiSdk.removeWhatsappAccount({ path: { id } }), WhatsappErrors.UNLINK_FAILED);
  }
}
