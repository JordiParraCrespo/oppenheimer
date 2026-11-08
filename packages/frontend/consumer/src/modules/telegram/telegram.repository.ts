import { heyApiSdk, type TelegramAccountResponseDto } from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { TelegramErrors } from './telegram.errors';
import { TelegramAccountEntity } from './telegram-account.entity';

function toAccount(data: TelegramAccountResponseDto): TelegramAccountEntity {
  return new TelegramAccountEntity(
    data.id,
    data.hostId,
    data.label,
    data.status,
    data.hostOnline,
    data.botId ?? null,
    data.username ?? null,
    data.displayName ?? null,
    data.statusReason ?? null,
    data.linkedAt,
  );
}

/**
 * The reader's own Telegram bots (`product/next-steps/telegram.md`): connected
 * on one of their hosts by pasting the token @BotFather gave, given a new
 * token, and disconnected. The token goes to the host and is never read back;
 * what their bots read and send there never passes through the console.
 */
@injectable()
export class TelegramRepository {
  findAccounts(): Promise<TelegramAccountEntity[]> {
    return callApi(TelegramErrors.FETCH_ACCOUNTS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findTelegramAccounts());
      return data.map(toAccount);
    });
  }

  /** Connects a bot on a host, or hands the reader's bot there a new token. */
  link(hostId: string, token: string, label?: string): Promise<TelegramAccountEntity> {
    return callApi(TelegramErrors.LINK_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.linkTelegram({ body: { hostId, token, ...(label ? { label } : {}) } }),
      );
      return toAccount(data);
    });
  }

  unlink(id: string): Promise<void> {
    return callApi(TelegramErrors.UNLINK_FAILED, async (api) => {
      await api.result(heyApiSdk.removeTelegramAccount({ path: { id } }));
    });
  }
}
