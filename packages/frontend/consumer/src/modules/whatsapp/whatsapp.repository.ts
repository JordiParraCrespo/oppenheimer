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
    data.answeringBotId ?? null,
    data.ownerNumber ?? null,
    data.ownerPendingNumber ?? null,
    data.ownerCodeExpiresAt ? new Date(data.ownerCodeExpiresAt) : null,
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

  /** Which of the reader's bots answers them on this number by default; null for none. */
  answerAs(id: string, answeringBotId: string | null): Promise<WhatsappAccountEntity> {
    return callApi(WhatsappErrors.UPDATE_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.updateWhatsappAccount({ path: { id }, body: { answeringBotId } }),
      );
      return toAccount(data);
    });
  }

  /**
   * Names the reader's own number: this one sends it a six-digit code, to be
   * entered with {@link confirmOwner} within ten minutes. Asking again sends
   * a new code and the old one stops working; a confirmed number stays the
   * owner until another is confirmed. The code itself never comes back here.
   */
  requestOwner(id: string, phone: string): Promise<WhatsappAccountEntity> {
    return callApi(WhatsappErrors.OWNER_REQUEST_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.requestWhatsappOwner({ path: { id }, body: { phone } }),
      );
      return toAccount(data);
    });
  }

  /**
   * Enters the code the reader's number received, which makes that number
   * the only one answered here. A wrong or expired code is WHATSAPP_011, no
   * number waiting WHATSAPP_012, and the fifth wrong one WHATSAPP_014.
   */
  confirmOwner(id: string, code: string): Promise<WhatsappAccountEntity> {
    return callApi(WhatsappErrors.OWNER_CONFIRM_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.confirmWhatsappOwner({ path: { id }, body: { code } }));
      return toAccount(data);
    });
  }

  unlink(id: string): Promise<void> {
    return callApi(WhatsappErrors.UNLINK_FAILED, async (api) => {
      await api.result(heyApiSdk.removeWhatsappAccount({ path: { id } }));
    });
  }
}
