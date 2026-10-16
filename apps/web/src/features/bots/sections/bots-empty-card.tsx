import { Button, SidebarEmptyCard } from '@oppenheimer/design-system-web';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useNewBot } from '@/features/bots/hooks/use-create-bot';

/** Before the first bot: what will appear here, and New bot. */
export function BotsEmptyCard() {
  const { t } = useTranslation();
  const newBot = useNewBot();

  return (
    <SidebarEmptyCard
      title={t('bots.sidebar.emptyTitle')}
      action={
        <Button
          variant="secondary"
          size="sm"
          pending={newBot.pending}
          pendingLabel={t('bots.sidebar.creating')}
          onClick={newBot.create}
        >
          {t('bots.sidebar.new')}
        </Button>
      }
    >
      {t('bots.sidebar.emptyBody')}
      <ErrorAlert error={newBot.error} fallback={t('bots.sidebar.createFailed')} className="mt-2" />
    </SidebarEmptyCard>
  );
}
