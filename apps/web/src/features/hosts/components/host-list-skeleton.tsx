import { HostCardSkeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** As many cards as a workspace usually pairs: enough to stand for the list. */
const CARDS = 2;

/**
 * The hosts before they answer: the list's column of cards, each the host
 * card's own frame with a bar where its name, meta line, state and last-seen
 * go, so the cards that replace them land where they stood.
 */
export function HostListSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-2.5">
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      {Array.from({ length: CARDS }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity but their place.
        <HostCardSkeleton key={index} index={index} />
      ))}
    </div>
  );
}
