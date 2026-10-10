import { Callout } from '@oppenheimer/design-system-web';
import { type Control, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ShareLinkValues } from '../lib/share-links';

/**
 * A link that types is a shell on the host, as the person sharing it. Said
 * plainly whenever one is being made, and more plainly when it is open to
 * more than named people.
 */
export function ShareWriteWarning({ control }: { control: Control<ShareLinkValues> }) {
  const { t } = useTranslation();
  const [access, audience] = useWatch({ control, name: ['access', 'audience'] });
  if (access !== 'write') return null;
  return (
    <Callout tone="warning">
      {audience === 'people' ? t('sessions.share.writeNote') : t('sessions.share.writeWarning')}
    </Callout>
  );
}
