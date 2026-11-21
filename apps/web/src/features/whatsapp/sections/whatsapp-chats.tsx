import {
  Button,
  Checkbox,
  EmptyState,
  PillTab,
  PillTabs,
  SearchableFacetSelect,
  SettingsGroup,
} from '@oppenheimer/design-system-web';
import type { BotEntity, WhatsappAccountEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseWhatsappChats } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatSearchField } from '@/features/whatsapp/components/chat-search-field';
import { WhatsappOwnerChatRow } from '@/features/whatsapp/components/whatsapp-owner-chat-row';
import { useChatsFilter } from '@/features/whatsapp/hooks/use-chats-filter';
import { CHATS_PAGE_SIZE, type ChatsBy, filterChats } from '@/features/whatsapp/lib/chat-filter';
import { CHAT_TABS, type ChatTab } from '@/features/whatsapp/lib/chats-search';
import { WhatsappChatRow } from '@/features/whatsapp/sections/whatsapp-chat-row';
import { WhatsappChatsBulk } from '@/features/whatsapp/sections/whatsapp-chats-bulk';

/**
 * Every chat a number has seen, with who answers each: groups or people, a
 * search, a filter by who answers (with what picking it would leave), the
 * page's rows, each with its own picker, and, once some are ticked, the bar
 * that answers them all at once. The narrowing lives in the address; the
 * ticks live here, and clear when the narrowing changes.
 */
export function WhatsappChats({
  account,
  bots,
}: {
  account: WhatsappAccountEntity;
  bots: readonly BotEntity[];
}) {
  const { t } = useTranslation();
  const { data: chats, error } = useSuspenseWhatsappChats(account.id);
  const { filter, setTab, setQuery, setBy, setPage } = useChatsFilter();
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const defaultBotName = bots.find((bot) => bot.id === account.answeringBotId)?.name ?? null;
  const owner = account.ownerNumber
    ? { number: account.ownerNumber, title: t('settings.whatsapp.chats.you') }
    : null;
  const view = filterChats(chats, filter, account.answeringBotId, owner);
  const onPage = view.rows.flatMap((row) => (row.kind === 'chat' ? [row.key] : []));
  const allTicked = onPage.length > 0 && onPage.every((id) => ticked.has(id));
  const narrow = (apply: () => void) => {
    setTicked(new Set());
    apply();
  };
  const tick = (chatId: string, on: boolean) =>
    setTicked((previous) => {
      const next = new Set(previous);
      if (on) next.add(chatId);
      else next.delete(chatId);
      return next;
    });

  const byOptions: { value: ChatsBy; label: string }[] = [
    { value: 'all', label: t('settings.whatsapp.chats.byAll') },
    { value: 'answered', label: t('settings.whatsapp.chats.byAnswered') },
    { value: 'none', label: t('settings.whatsapp.chats.none') },
    { value: 'default', label: t('settings.whatsapp.chats.byDefault') },
    ...bots.map((bot) => ({ value: bot.id, label: bot.name })),
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 px-1 text-sm text-fg-muted">
        {t('settings.whatsapp.chats.summary', {
          answered: view.answeredCount,
          count: view.count,
        })}
      </p>
      <ErrorAlert error={error} fallback={t('settings.whatsapp.chats.loadFailed')} />
      <div className="flex flex-wrap items-center gap-2 px-1">
        <PillTabs
          size="sm"
          aria-label={t('settings.whatsapp.chats.tabsLabel')}
          value={filter.tab}
          onValueChange={(tab) => narrow(() => setTab(tab as ChatTab))}
        >
          {CHAT_TABS.map((tab) => (
            <PillTab key={tab} value={tab} count={view.tabCounts[tab]}>
              {t(`settings.whatsapp.chats.tabs.${tab}`)}
            </PillTab>
          ))}
        </PillTabs>
        <ChatSearchField
          label={t('settings.whatsapp.chats.search')}
          value={filter.query}
          onChange={(query) => narrow(() => setQuery(query))}
        />
        <SearchableFacetSelect
          size="sm"
          label={t('settings.whatsapp.chats.byLabel')}
          value={filter.by}
          onValueChange={(by) => narrow(() => setBy(by))}
          options={byOptions.map((option) => ({ ...option, count: view.byCount(option.value) }))}
          searchPlaceholder={t('settings.whatsapp.chats.bySearch')}
          emptyText={(query) => t('settings.whatsapp.chats.byNoMatch', { query })}
        />
      </div>
      {ticked.size > 0 ? (
        <WhatsappChatsBulk
          accountId={account.id}
          chatIds={[...ticked]}
          bots={bots}
          defaultBotName={defaultBotName}
          onDone={() => setTicked(new Set())}
        />
      ) : null}
      {view.total === 0 ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>
              {view.count === 0
                ? t('settings.whatsapp.chats.emptyTitle')
                : t('settings.whatsapp.chats.noMatch')}
            </EmptyState.Title>
            {view.count === 0 ? (
              <EmptyState.Description>
                {t('settings.whatsapp.chats.emptyDescription')}
              </EmptyState.Description>
            ) : null}
          </EmptyState.Header>
        </EmptyState>
      ) : (
        <>
          <SettingsGroup>
            <div className="flex items-center gap-3 py-2 pl-5 text-[12px] text-fg-subtle">
              <Checkbox
                aria-label={t('settings.whatsapp.chats.selectPage')}
                checked={allTicked}
                onCheckedChange={(checked) =>
                  setTicked((previous) => {
                    const next = new Set(previous);
                    for (const id of onPage) {
                      if (checked === true) next.add(id);
                      else next.delete(id);
                    }
                    return next;
                  })
                }
              />
              {t('settings.whatsapp.chats.selectPage')}
            </div>
            {view.rows.map((row) =>
              row.kind === 'owner' ? (
                <WhatsappOwnerChatRow
                  key={row.key}
                  number={row.number}
                  defaultBotName={defaultBotName}
                />
              ) : (
                <WhatsappChatRow
                  key={row.key}
                  chat={row.chat}
                  bots={bots}
                  defaultBotName={defaultBotName}
                  selected={ticked.has(row.key)}
                  onSelect={(on) => tick(row.key, on)}
                />
              ),
            )}
          </SettingsGroup>
          <div className="flex items-center gap-2 px-1 text-sm text-fg-muted">
            <span className="flex-1">
              {t('settings.whatsapp.chats.range', {
                from: (view.page - 1) * CHATS_PAGE_SIZE + 1,
                to: (view.page - 1) * CHATS_PAGE_SIZE + view.rows.length,
                count: view.total,
              })}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={view.page <= 1}
              onClick={() => setPage(view.page - 1)}
            >
              {t('settings.whatsapp.chats.previous')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={view.page >= view.pages}
              onClick={() => setPage(view.page + 1)}
            >
              {t('settings.whatsapp.chats.next')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
