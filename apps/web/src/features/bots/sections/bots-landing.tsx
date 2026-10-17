import { Button, ChatEmptyState } from '@oppenheimer/design-system-web';
import { useBotGroups, useBots } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Navigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useNewBot } from '@/features/bots/hooks/use-create-bot';
import { firstBot } from '@/features/bots/lib/bot-groups';

/**
 * `/bots` with no bot open. A workspace with bots goes straight to the chat
 * of the one the sidebar draws first, replacing `/bots` in history so Back
 * does not bounce here; the sidebar's New bot makes another. Before the
 * first bot it is the design's new-chat greeting, "Make your first bot.",
 * over New bot. It says nothing until both reads land, and nothing false
 * when one fails.
 */
export function BotsLanding() {
  const { t } = useTranslation();
  const bots = useBots();
  const groups = useBotGroups();
  const newBot = useNewBot();
  if (bots.isPending || groups.isPending) return null;
  // A failed read is not "no bots": the sidebar beside this says what failed.
  const error = bots.error ?? groups.error;
  if (error) return <ErrorAlert error={error} fallback={t('bots.sidebar.loadFailed')} />;
  const first = firstBot(bots.data ?? [], groups.data ?? []);
  if (first) return <Navigate to="/bots/$botId" params={{ botId: first.id }} replace />;

  return (
    <ChatEmptyState align="center" title={t('bots.landing.titleEmpty')}>
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
