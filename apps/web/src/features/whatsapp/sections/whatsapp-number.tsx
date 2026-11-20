import {
  Button,
  Callout,
  EmptyState,
  SettingsGroup,
  SettingsHeading,
} from '@oppenheimer/design-system-web';
import { MessageCircle } from '@oppenheimer/design-system-web/icons';
import { useSuspenseWhatsappSettings } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { WhatsappChatsSkeleton } from '@/features/whatsapp/components/whatsapp-chats-skeleton';
import { whatsappHostsOf } from '@/features/whatsapp/lib/whatsapp-hosts';
import { WhatsappAccountRow } from '@/features/whatsapp/sections/whatsapp-account-row';
import { WhatsappAnsweringRow } from '@/features/whatsapp/sections/whatsapp-answering-row';
import { WhatsappChats } from '@/features/whatsapp/sections/whatsapp-chats';
import { WhatsappOwnerRow } from '@/features/whatsapp/sections/whatsapp-owner-row';

/**
 * One of the reader's numbers: its row, its default bot and the reader's own
 * number, then, once that is confirmed, every chat it has seen with who
 * answers each, read on its own so the number draws without waiting for it.
 * A number unlinked meanwhile says so, with the way back.
 */
export function WhatsappNumber({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const { accounts, hosts, bots, error } = useSuspenseWhatsappSettings();
  const account = accounts.find((row) => row.id === accountId);
  const hostName = whatsappHostsOf(hosts).find((host) => host.id === account?.hostId)?.name;

  if (!account) {
    return (
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <MessageCircle />
          </EmptyState.Media>
          <EmptyState.Title>{t('settings.whatsapp.chats.goneTitle')}</EmptyState.Title>
        </EmptyState.Header>
        <EmptyState.Content>
          <Button size="sm" variant="secondary" render={<Link to="/settings/whatsapp" />}>
            {t('settings.whatsapp.chats.back')}
          </Button>
        </EmptyState.Content>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ErrorAlert error={error} fallback={t('settings.whatsapp.loadFailed')} />
      <SettingsGroup>
        <WhatsappAccountRow account={account} hostName={hostName ?? null} />
        <WhatsappAnsweringRow account={account} bots={bots} />
        <WhatsappOwnerRow account={account} />
      </SettingsGroup>
      <section className="flex flex-col gap-2.5">
        <SettingsHeading>{t('settings.whatsapp.chats.title')}</SettingsHeading>
        {account.ownerNumber ? (
          <QueryState>
            <QueryState.Pending>
              <WhatsappChatsSkeleton />
            </QueryState.Pending>
            <QueryState.Error fallback={t('settings.whatsapp.chats.loadFailed')} />
            <QueryState.Data>
              <WhatsappChats account={account} bots={bots} />
            </QueryState.Data>
          </QueryState>
        ) : (
          <Callout>{t('settings.whatsapp.chats.ownerFirst')}</Callout>
        )}
      </section>
    </div>
  );
}
