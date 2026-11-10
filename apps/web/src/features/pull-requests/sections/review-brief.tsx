import { Callout } from '@oppenheimer/design-system-web';
import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { useSuspensePullRequestBrief } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BriefImage } from '../components/brief-image';

/**
 * A card's brief, the way a catch-up reads: one sentence first, then the
 * pictures the author attached, then the few things that changed and where to
 * look first. Read under Suspense, in the card's `QueryState`. The last line
 * says who wrote it, the model or the author, since the two are trusted
 * differently.
 */
export function ReviewBrief({ address }: { address: PullRequestAddress }) {
  const { t } = useTranslation();
  const { data: brief, error } = useSuspensePullRequestBrief(address);
  return (
    <div className="flex flex-col gap-5">
      <ErrorAlert error={error} fallback={t('pullRequests.deck.briefFailed')} />
      <p className="m-0 text-xl leading-snug font-medium text-fg">{brief.headline}</p>
      {brief.images.length ? (
        <ul className="no-scrollbar m-0 flex list-none gap-3 overflow-x-auto p-0 empty:hidden">
          {brief.images.map((image) => (
            <BriefImage key={image.url} url={image.url} alt={image.alt} />
          ))}
        </ul>
      ) : null}
      {brief.points.length ? (
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-body text-fg">
          {brief.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
      {brief.lookFirst ? (
        <Callout>
          <span className="font-medium text-fg">{t('pullRequests.deck.lookFirst')}</span>{' '}
          {brief.lookFirst}
        </Callout>
      ) : null}
      <p className="m-0 text-xs text-fg-subtle">{t(`pullRequests.deck.source.${brief.source}`)}</p>
    </div>
  );
}
