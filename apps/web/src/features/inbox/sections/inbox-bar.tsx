import { useNow } from '@oppenheimer/design-system-web';
import { useInboxCount, useSessions } from '@oppenheimer/frontend-consumer/react';
import { PageBar } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The bar over the Inbox: its name, and how many things need you and how
 * many sessions run, once both are known. It reads the counts on their own,
 * so it draws while the pane still loads.
 */
export function InboxBar() {
  const { t } = useTranslation();
  const now = useNow(60_000);
  const needs = useInboxCount(now);
  const { data: running } = useSessions({
    select: (rows) => rows.filter((session) => session.isLive).length,
  });

  return (
    <PageBar
      title={t('inbox.title')}
      meta={
        needs === undefined || running === undefined
          ? undefined
          : running === 0
            ? t('inbox.bar.needs', { count: needs })
            : t('inbox.bar.meta', {
                needs: t('inbox.bar.needs', { count: needs }),
                running: t('inbox.bar.running', { count: running }),
              })
      }
    />
  );
}
