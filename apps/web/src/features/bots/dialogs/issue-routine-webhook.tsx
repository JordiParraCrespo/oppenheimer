import {
  Button,
  Checkbox,
  CodeBlock,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { useIssueBotRoutineWebhook } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A routine's webhook URL, new: whether requests must be signed, then the URL
 * and its signing secret, shown this once. They live in the mutation's result
 * alone, so closing the dialog is the last of them. A routine that had a URL
 * gets a new one, and its old one stops working.
 */
export function IssueRoutineWebhookDialog({
  botId,
  routineId,
  name,
  replacing,
  onClose,
}: {
  botId: string;
  routineId: string;
  name: string;
  /** It already has a URL, which this one replaces. */
  replacing: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [signed, setSigned] = useState(false);
  const issue = useIssueBotRoutineWebhook();
  const issued = issue.data;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('bots.settings.routines.webhookUrl.dialogTitle', { name })}</DialogTitle>
          <DialogDescription>
            {issued
              ? t('bots.settings.routines.webhookUrl.shownOnce')
              : t('bots.settings.routines.webhookUrl.dialogBody')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-2">
            <ErrorAlert
              error={issue.error}
              fallback={t('bots.settings.routines.webhookUrl.failed')}
            />
            {issued ? (
              <>
                <CodeBlock
                  title={t('bots.settings.routines.webhookUrl.url')}
                  code={issued.url}
                  copyLabel={t('common.copy')}
                  copiedLabel={t('common.copied')}
                />
                {issued.signingSecret ? (
                  <>
                    <CodeBlock
                      title={t('bots.settings.routines.webhookUrl.secret')}
                      code={issued.signingSecret}
                      copyLabel={t('common.copy')}
                      copiedLabel={t('common.copied')}
                    />
                    <p className="text-sm text-fg-muted">
                      {t('bots.settings.routines.webhookUrl.signHow')}
                    </p>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {replacing ? (
                  <p className="text-sm text-fg-muted">
                    {t('bots.settings.routines.webhookUrl.replaces')}
                  </p>
                ) : null}
                {/* biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control. */}
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={signed}
                    onCheckedChange={(checked) => setSigned(checked)}
                    disabled={issue.isPending}
                  />
                  {t('bots.settings.routines.webhookUrl.signed')}
                </label>
              </>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          {issued ? (
            <Button onClick={onClose}>{t('bots.settings.routines.webhookUrl.done')}</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={issue.isPending}>
                {t('common.cancel')}
              </Button>
              <Button
                pending={issue.isPending}
                pendingLabel={t('bots.settings.routines.webhookUrl.creating')}
                onClick={() => issue.mutate({ id: botId, routineId, signed })}
              >
                {replacing
                  ? t('bots.settings.routines.webhookUrl.newUrl')
                  : t('bots.settings.routines.webhookUrl.create')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
