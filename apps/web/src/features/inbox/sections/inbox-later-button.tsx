import { Button } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { useInboxPutAway } from '@/features/inbox/hooks/use-inbox-deck';
import { useInboxSearch } from '@/features/inbox/hooks/use-inbox-search';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';

/**
 * Later: the card goes off to the left, the item to the end of the list for
 * this visit, and the deck moves on to the one after it.
 */
export function InboxLaterButton({ itemKey }: { itemKey: string }) {
  const { t } = useTranslation();
  const search = useInboxSearch();
  const putAway = useInboxPutAway();

  return (
    <Button
      variant="ghost"
      onClick={() =>
        putAway(itemKey, 'left', () => {
          const next = inboxVisit.get().following[itemKey] ?? null;
          inboxVisit.later(itemKey);
          search.advance(next);
        })
      }
    >
      {t('inbox.card.later')}
    </Button>
  );
}
