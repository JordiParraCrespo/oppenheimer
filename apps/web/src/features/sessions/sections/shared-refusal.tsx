import { Button } from '@oppenheimer/design-system-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SharedNotice } from '../components/shared-notice';
import type { ShareRefusal } from '../lib/share-session';

/**
 * A share that does not open for this guest, said as its own answer: sign in
 * (and come back here), not shared with you, or not shared at all.
 */
export function SharedRefusal({ refusal, slug }: { refusal: ShareRefusal; slug: string }) {
  const { t } = useTranslation();

  return (
    <SharedNotice
      title={t(`sessions.shared.${refusal}.title`)}
      body={t(`sessions.shared.${refusal}.body`)}
      action={
        refusal === 'signIn' ? (
          <Button render={<Link to="/login" search={{ redirect: `/s/${slug}` }} />}>
            {t('sessions.shared.signIn.action')}
          </Button>
        ) : undefined
      }
    />
  );
}
