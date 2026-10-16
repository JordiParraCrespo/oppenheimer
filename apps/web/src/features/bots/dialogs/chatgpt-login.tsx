import {
  Button,
  Callout,
  CodeBlock,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  StatusDot,
} from '@oppenheimer/design-system-web';
import { useChatgptLogin } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Connect ChatGPT: the device sign-in the Codex CLI runs. Opening the dialog
 * asks for a code; the person types it on OpenAI's page and approves, and
 * the dialog says so once the workspace's sign-in is stored. A code that
 * lapses is replaced on request, never on its own.
 */
export function ChatgptLoginDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { login, state, isStarting, error, restart } = useChatgptLogin();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('settings.modelProviders.chatgpt.title')}</DialogTitle>
          <DialogDescription>{t('settings.modelProviders.chatgpt.description')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-2">
            <ErrorAlert error={error} fallback={t('settings.modelProviders.chatgpt.failed')} />
            {state === 'connected' ? (
              <Callout tone="success">{t('settings.modelProviders.chatgpt.connected')}</Callout>
            ) : state === 'expired' ? (
              <Callout tone="warning">{t('settings.modelProviders.chatgpt.expired')}</Callout>
            ) : login ? (
              <>
                <p className="text-sm text-fg-muted">{t('settings.modelProviders.chatgpt.step')}</p>
                <CodeBlock
                  data-testid="chatgpt-user-code"
                  title={t('settings.modelProviders.chatgpt.codeTitle')}
                  code={login.userCode}
                  note={t('settings.modelProviders.chatgpt.expires')}
                  copyLabel={t('common.copy')}
                  copiedLabel={t('common.copied')}
                />
                <StatusDot state="waiting" pulse>
                  {t('settings.modelProviders.chatgpt.waiting')}
                </StatusDot>
              </>
            ) : isStarting ? (
              <Skeleton className="h-24 w-full" />
            ) : null}
          </div>
        </DialogBody>
        <DialogFooter>
          {state === 'connected' ? (
            <Button onClick={onClose}>{t('settings.modelProviders.chatgpt.done')}</Button>
          ) : state === 'expired' || (error && !login) ? (
            <Button pending={isStarting} onClick={restart}>
              {t('settings.modelProviders.chatgpt.newCode')}
            </Button>
          ) : login ? (
            <Button render={<a href={login.verificationUrl} target="_blank" rel="noreferrer" />}>
              {t('settings.modelProviders.chatgpt.open')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
