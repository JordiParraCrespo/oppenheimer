import { Card, CardContent, CardFooter, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { CommentersSkeleton } from './commenters-skeleton';
import { PersonRow } from './person-row';
import { ProseLine } from './prose-line';
import { RailSection } from './rail-section';

/** A description as it usually falls: a paragraph, a heading, another paragraph, as line widths. */
const OPENING = ['w-full', 'w-11/12', 'w-2/5'];
const BODY = ['w-full', 'w-10/12', 'w-full', 'w-3/5'];

/**
 * A pull request's description before it answers, laid out as the page is:
 * the header's three lines and the description's card on the left, and the
 * rail at its width with its four sections' labels written, so neither
 * column moves when the pull request lands.
 */
export function DescriptionSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-14">
      <LoadingStatus />
      <div aria-hidden className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2.5 pb-2">
          <div className="flex h-6 items-center gap-2">
            <Skeleton shape="pill" className="h-6 w-16" />
            <Skeleton shape="pill" className="h-5.5 w-12" />
            <Skeleton shape="sm" className="h-2.5 w-20" />
          </div>
          <div className="flex h-8 items-center">
            <Skeleton shape="sm" className="h-6 w-3/5" />
          </div>
          <div className="flex h-5 items-center gap-2">
            <Skeleton shape="sm" className="h-2.5 w-16" />
            <Skeleton shape="sm" className="h-2.5 w-44" />
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-2">
            {OPENING.map((width, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a line's place is its identity.
              <ProseLine key={index} width={width} />
            ))}
            <div className="flex h-12 items-end pb-2">
              <Skeleton shape="sm" className="h-4 w-36" />
            </div>
            {BODY.map((width, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a line's place is its identity.
              <ProseLine key={index} width={width} />
            ))}
          </CardContent>
          <CardFooter className="justify-end">
            <Skeleton shape="pill" className="h-7 w-34" />
          </CardFooter>
        </Card>
      </div>
      <aside className="flex flex-col lg:w-72 lg:shrink-0">
        <RailSection label={t('pullRequests.detail.rail.mergeStatus')}>
          <div aria-hidden className="flex h-5 items-center gap-2.5">
            <Skeleton shape="pill" className="size-4" />
            <Skeleton shape="sm" className="h-3 w-44" />
          </div>
        </RailSection>
        <RailSection label={t('pullRequests.detail.rail.comments')}>
          <CommentersSkeleton />
        </RailSection>
        <RailSection label={t('pullRequests.detail.rail.reviews')}>
          <PersonRow />
        </RailSection>
        <RailSection
          label={t('pullRequests.detail.checks')}
          aside={<Skeleton shape="sm" className="h-2.5 w-20" />}
        />
      </aside>
    </div>
  );
}
