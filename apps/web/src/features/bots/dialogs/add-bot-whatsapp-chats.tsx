import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PillTab,
  PillTabs,
} from '@oppenheimer/design-system-web';
import type { BotEntity, WhatsappChatRouteEntity } from '@oppenheimer/frontend-consumer';
import { useRouteWhatsappChats } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolSearchField } from '@/features/bots/components/tool-search-field';

type Tab = 'group' | 'person';

/**
 * Picks chats of one number for this bot to answer: groups or people, a
 * search, and a tick per chat, each saying who answers it now, since adding
 * it moves it here from them. The search field holds what is typed and hands
 * the list the settled words, so a keystroke does not redraw every chat.
 * Owns its write; closes on success.
 */
export function AddBotWhatsappChatsDialog({
  botId,
  accountId,
  chats,
  bots,
  defaultBotId,
  onClose,
}: {
  botId: string;
  accountId: string;
  chats: readonly WhatsappChatRouteEntity[];
  bots: readonly BotEntity[];
  defaultBotId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('group');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const route = useRouteWhatsappChats({ onSuccess: onClose });
  const names = new Map(bots.map((bot) => [bot.id, bot.name]));
  const words = query.trim().toLowerCase();
  const candidates = chats.filter(
    (chat) =>
      !(chat.answer.kind === 'bot' && chat.answer.botId === botId) &&
      chat.isGroup === (tab === 'group') &&
      (!words || `${chat.title} ${chat.phone ?? ''}`.toLowerCase().includes(words)),
  );
  const nowAnswering = (chat: WhatsappChatRouteEntity) => {
    const answer = chat.answer;
    if (answer.kind === 'bot')
      return names.get(answer.botId) ?? t('bots.settings.gateways.anotherBot');
    if (answer.kind === 'default' && defaultBotId) {
      return t('bots.settings.gateways.nowDefault', { bot: names.get(defaultBotId) ?? '' });
    }
    return t('bots.settings.gateways.nowNone');
  };
  const toggle = (chatId: string, on: boolean) =>
    setPicked((previous) => {
      const next = new Set(previous);
      if (on) next.add(chatId);
      else next.delete(chatId);
      return next;
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('bots.settings.gateways.addTitle')}</DialogTitle>
          <DialogDescription>{t('bots.settings.gateways.addDescription')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <PillTabs
                size="sm"
                aria-label={t('bots.settings.gateways.tabsLabel')}
                value={tab}
                onValueChange={(next) => setTab(next as Tab)}
              >
                <PillTab value="group">{t('bots.settings.gateways.groups')}</PillTab>
                <PillTab value="person">{t('bots.settings.gateways.people')}</PillTab>
              </PillTabs>
              <ToolSearchField
                size="sm"
                className="ml-auto w-52 max-w-full"
                value={query}
                onChange={setQuery}
                label={t('bots.settings.gateways.search')}
              />
            </div>
            <ul className="m-0 flex max-h-80 list-none flex-col overflow-y-auto p-0">
              {candidates.map((chat) => (
                <li key={chat.chatId} className="flex items-center gap-3 py-2">
                  <Checkbox
                    aria-label={chat.title}
                    checked={picked.has(chat.chatId)}
                    onCheckedChange={(checked) => toggle(chat.chatId, checked === true)}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-fg">{chat.title}</span>
                    <span className="text-[12px] text-fg-subtle">
                      {t('bots.settings.gateways.now', { who: nowAnswering(chat) })}
                    </span>
                  </span>
                </li>
              ))}
              {candidates.length === 0 ? (
                <li className="py-2 text-sm text-fg-muted">
                  {t('bots.settings.gateways.noCandidates')}
                </li>
              ) : null}
            </ul>
            <ErrorAlert
              error={route.error}
              fallback={t('bots.settings.gateways.routeFailed')}
              onDismiss={route.reset}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={picked.size === 0}
            pending={route.isPending}
            onClick={() =>
              route.mutate({ accountId, chatIds: [...picked], answer: { kind: 'bot', botId } })
            }
          >
            {picked.size === 0
              ? t('bots.settings.gateways.add')
              : t('bots.settings.gateways.addCount', { count: picked.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
