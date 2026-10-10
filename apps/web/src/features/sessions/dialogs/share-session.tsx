import {
  Button,
  Callout,
  CodeBlock,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Separator,
} from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useCreateShareLink } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ShareLinkForm } from '../forms/share-link';
import { shareLinkUrl } from '../lib/share-links';
import { ShareLinks } from '../sections/share-links';

/**
 * Share a session's terminal with a link. The form makes one; the answer is
 * the only time its address exists, so it replaces the form with the address
 * to copy, and Another link brings the form back. The live links sit under
 * either, each revocable.
 */
export function ShareSessionDialog({
  session,
  onClose,
}: {
  session: SessionEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateShareLink();
  const made = create.data;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-130">
        <DialogHeader>
          <DialogTitle>{t('sessions.share.title', { name: session.name })}</DialogTitle>
          <DialogDescription>{t('sessions.share.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-5 pb-7">
            {made ? (
              <div className="flex flex-col gap-3">
                <CodeBlock
                  code={shareLinkUrl(window.location.origin, made.token)}
                  title={t('sessions.share.linkTitle')}
                  copyLabel={t('common.copy')}
                  copiedLabel={t('common.copied')}
                />
                <Callout>{t('sessions.share.onceOnly')}</Callout>
                <div className="flex justify-end">
                  <Button variant="secondary" onClick={() => create.reset()}>
                    {t('sessions.share.another')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ErrorAlert error={create.error} fallback={t('sessions.share.failed')} />
                <ShareLinkForm
                  isPending={create.isPending}
                  onSubmit={(input) => create.mutate({ sessionId: session.id, input })}
                />
              </>
            )}
            <Separator />
            <ShareLinks sessionId={session.id} />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
