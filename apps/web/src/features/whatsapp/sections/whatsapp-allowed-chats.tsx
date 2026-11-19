import { SettingsListRowSkeleton } from '@oppenheimer/design-system-web';
import type { BotEntity, WhatsappAccountEntity } from '@oppenheimer/frontend-consumer';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { WhatsappAllowedChatsList } from '@/features/whatsapp/sections/whatsapp-allowed-chats-list';

/**
 * Who else may talk to the reader's bots on one of their numbers, read on its
 * own under the number's rows, so the numbers draw without waiting for it.
 */
export function WhatsappAllowedChats({
  account,
  bots,
}: {
  account: WhatsappAccountEntity;
  bots: readonly BotEntity[];
}) {
  const { t } = useTranslation();
  return (
    <QueryState>
      <QueryState.Pending>
        <SettingsListRowSkeleton className="items-center" />
      </QueryState.Pending>
      <QueryState.Error fallback={t('settings.whatsapp.allowed.loadFailed')} />
      <QueryState.Data>
        <WhatsappAllowedChatsList account={account} bots={bots} />
      </QueryState.Data>
    </QueryState>
  );
}
