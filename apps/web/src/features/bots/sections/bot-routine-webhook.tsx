import { Button } from '@oppenheimer/design-system-web';
import { Webhook } from '@oppenheimer/design-system-web/icons';
import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { useLocale } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IssueRoutineWebhookDialog } from '@/features/bots/dialogs/issue-routine-webhook';
import { RevokeRoutineWebhookDialog } from '@/features/bots/dialogs/revoke-routine-webhook';
import { routineMoment } from '@/features/bots/lib/routine-text';

/**
 * A routine's webhook, under its card when one of its triggers is a webhook:
 * whether it has a URL (only its start is shown), signed or not, when
 * something was last posted, and the buttons that issue a new URL or revoke
 * it. The bot adds the trigger in chat; the URL and its secret are the
 * person's, issued here.
 */
export function BotRoutineWebhook({
  botId,
  routine,
}: {
  botId: string;
  routine: BotRoutineEntity;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [dialog, setDialog] = useState<'issue' | 'revoke' | null>(null);
  const { webhook } = routine;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm border border-border-subtle px-3.5 py-2.5 text-sm"
      data-testid="routine-webhook"
    >
      <Webhook className="size-4 shrink-0 text-fg-muted" aria-hidden />
      <div className="min-w-0 flex-1">
        {webhook ? (
          <>
            <span className="font-mono text-xs text-fg">{`${webhook.tokenPrefix}…`}</span>
            <span className="text-fg-muted">
              {' · '}
              {webhook.signed
                ? t('bots.settings.routines.webhookUrl.isSigned')
                : t('bots.settings.routines.webhookUrl.isUnsigned')}
              {' · '}
              {webhook.lastReceivedAt
                ? t('bots.settings.routines.webhookUrl.lastReceived', {
                    when: routineMoment(webhook.lastReceivedAt, locale),
                  })
                : t('bots.settings.routines.webhookUrl.neverReceived')}
            </span>
          </>
        ) : (
          <span className="text-fg-muted">{t('bots.settings.routines.webhookUrl.none')}</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setDialog('issue')}>
          {webhook
            ? t('bots.settings.routines.webhookUrl.newUrl')
            : t('bots.settings.routines.webhookUrl.create')}
        </Button>
        {webhook ? (
          <Button size="sm" variant="ghost" onClick={() => setDialog('revoke')}>
            {t('bots.settings.routines.webhookUrl.revoke')}
          </Button>
        ) : null}
      </div>
      {dialog === 'issue' ? (
        <IssueRoutineWebhookDialog
          botId={botId}
          routineId={routine.id}
          name={routine.name}
          replacing={webhook !== null}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'revoke' ? (
        <RevokeRoutineWebhookDialog
          botId={botId}
          routineId={routine.id}
          name={routine.name}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
