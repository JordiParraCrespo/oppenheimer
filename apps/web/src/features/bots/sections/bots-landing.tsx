import { Button, ChatEmptyState } from '@oppenheimer/design-system-web';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useNewBot } from '@/features/bots/hooks/use-create-bot';

/**
 * `/bots` with no bot open: the design's new-chat greeting, "Make your first
 * bot." before there is one and "Pick a bot" after, over New bot. Typing to a
 * bot that does not exist yet comes with the chat (`25-bots.md`, slice 2), so
 * the landing offers the button rather than a composer. It counts the bots
 * only to pick its words, and says nothing until it knows, and nothing
 * false when it cannot.
 */
export function BotsLanding() {
  const { t } = useTranslation();
  const { data: count, isPending, error } = useBots({ select: (rows) => rows.length });
  const newBot = useNewBot();
  if (isPending) return null;
  // A failed count is not "no bots": the sidebar beside this says what failed.
  if (error) return <ErrorAlert error={error} fallback={t('bots.sidebar.loadFailed')} />;

  return (
    <ChatEmptyState
      align="center"
      title={count ? t('bots.landing.title') : t('bots.landing.titleEmpty')}
    >
      <div className="flex flex-col items-center gap-3">
        <Button
          pending={newBot.pending}
          pendingLabel={t('bots.sidebar.creating')}
          onClick={newBot.create}
        >
          {t('bots.sidebar.new')}
        </Button>
        <p className="m-0 text-center text-xs text-fg-subtle">{t('bots.landing.note')}</p>
        <ErrorAlert error={newBot.error} fallback={t('bots.sidebar.createFailed')} />
      </div>
    </ChatEmptyState>
  );
}
