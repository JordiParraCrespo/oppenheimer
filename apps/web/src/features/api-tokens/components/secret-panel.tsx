import { Alert, AlertDescription, AlertTitle, Button } from '@oppenheimer/design-system-web';
import { useCopy } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The one and only time the secret exists outside the server. Deliberately
 * loud, and dismissed only by an explicit click.
 */
export function SecretPanel({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();

  return (
    <Alert>
      <AlertTitle>{t('apiTokens.created')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{t('apiTokens.shownOnce')}</span>
        <code className="block overflow-x-auto rounded bg-surface-sunken px-3 py-2 font-mono text-sm">
          {secret}
        </code>
        <span className="flex gap-2">
          <Button type="button" size="sm" onClick={() => copy(secret)}>
            {copied ? t('apiTokens.copied') : t('apiTokens.copy')}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
            {t('apiTokens.dismiss')}
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}
