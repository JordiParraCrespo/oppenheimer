import { Button, useCopy } from '@oppenheimer/design-system-web';
import { CheckIcon, CopyIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * A share's address with Copy link beside it. It can be copied again at any
 * time: the address is not the secret, who is let in is.
 */
export function ShareLinkCopy({ url }: { url: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy(url);
  return (
    <div className="flex items-center gap-2 rounded-sm border border-border-subtle bg-field py-1.25 pr-1.25 pl-3.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{url}</code>
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? t('sessions.share.copied') : t('sessions.share.copyLink')}
      </Button>
    </div>
  );
}
