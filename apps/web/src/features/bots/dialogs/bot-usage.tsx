import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotUsageSkeleton } from '@/features/bots/components/bot-usage-skeleton';
import { BotUsageSummary } from '@/features/bots/sections/bot-usage-summary';

/**
 * `/usage` (`25-bots.md` §4.1, "Built-in commands"): what the bot's chat has
 * spent, opened from the composer without sending the bot anything. The
 * figures read under Suspense; this draws the dialog, their placeholder and
 * a first failure.
 */
export function BotUsageDialog({ botId, onClose }: { botId: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('bots.chat.usage.title')}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <QueryState>
            <QueryState.Pending>
              <BotUsageSkeleton />
            </QueryState.Pending>
            <QueryState.Error>
              {(error, retry) => (
                <ErrorAlert
                  error={error}
                  fallback={t('bots.chat.usage.loadFailed')}
                  action={
                    <Button variant="ghost" size="sm" onClick={retry}>
                      {t('common.retry')}
                    </Button>
                  }
                />
              )}
            </QueryState.Error>
            <QueryState.Data>
              <BotUsageSummary botId={botId} />
            </QueryState.Data>
          </QueryState>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
