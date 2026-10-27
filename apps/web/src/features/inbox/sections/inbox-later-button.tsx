import { Button } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { useInboxSearch } from '@/features/inbox/hooks/use-inbox-search';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';

/** Later: the item goes to the end of the list for this visit, and the pane moves on to the first. */
export function InboxLaterButton({ itemKey }: { itemKey: string }) {
  const { t } = useTranslation();
  const search = useInboxSearch();

  return (
    <Button
      variant="ghost"
      onClick={() => {
        inboxVisit.later(itemKey);
        search.setItem(null);
      }}
    >
      {t('inbox.card.later')}
    </Button>
  );
}
