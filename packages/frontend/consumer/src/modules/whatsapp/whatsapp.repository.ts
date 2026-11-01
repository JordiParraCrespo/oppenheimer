import { heyApiSdk, type WhatsappAccountResponseDto } from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
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
  findAccounts(): Promise<WhatsappAccountEntity[]> {
    return callApi(WhatsappErrors.FETCH_ACCOUNTS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findWhatsappAccounts());
      return data.map(toAccount);
    });
  }

  /** Links a number on a host, or pairs the reader's number there again. */
  link(hostId: string, label?: string): Promise<WhatsappAccountEntity> {
    return callApi(WhatsappErrors.LINK_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.linkWhatsapp({ body: { hostId, ...(label ? { label } : {}) } }),
      );
      return toAccount(data);
    });
  }

  unlink(id: string): Promise<void> {
    return callApi(WhatsappErrors.UNLINK_FAILED, async (api) => {
      await api.result(heyApiSdk.removeWhatsappAccount({ path: { id } }));
    });
  }
}
