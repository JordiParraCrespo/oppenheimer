import { Button, useCopy } from '@oppenheimer/design-system-web';
import { CheckIcon, LinkIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * Copy link, at the foot of Share. It can be copied again at any time: the
 * address is not the secret, who is let in is. The address itself is the
 * button's title, so it can be read before it is copied.
 */
export function ShareLinkCopy({ url }: { url: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy(url);
  return (
    <Button type="button" variant="secondary" size="sm" title={url} onClick={copy}>
      {copied ? <CheckIcon /> : <LinkIcon />}
      {copied ? t('sessions.share.copied') : t('sessions.share.copyLink')}
    </Button>
  );
}
