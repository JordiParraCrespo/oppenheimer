import { Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** Where the month marks fall across the header, as a share of its width. */
const MONTHS = ['left-[6%]', 'left-[40%]', 'left-[74%]'];
/** Two projects' tracks, as a timeline usually holds: where each starts and how far it runs. */
const TRACKS = [
  { at: 'left-[10%] w-[46%]', name: 'w-36', marks: ['left-[30%] w-20', 'left-[88%] w-16'] },
  { at: 'left-[28%] w-[52%]', name: 'w-28', marks: ['left-[46%] w-24', 'left-[90%] w-14'] },
];

/**
 * The milestones timeline before the plan answers, edge to edge as it is:
 * the 56px header with its month and week marks as bars, and two 112px
 * project rows, each with its name bar over the track's own bordered frame
 * and a bar for each milestone's name under it, so the rows that replace
 * them sit where these did.
 */
export function MilestonesTimelineSkeleton() {
  const { t } = useTranslation();
  return (
    <div data-bleed aria-busy className="pb-3">
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      <div aria-hidden className="relative">
        <div className="relative h-14 border-b border-border-subtle">
          {MONTHS.map((left) => (
            <span key={left} className={`absolute top-1 flex h-3.5 items-center ${left}`}>
              <Skeleton shape="sm" className="h-2 w-14" />
            </span>
          ))}
          <div className="absolute top-7.5 inset-x-0 flex h-4 items-center justify-around">
            {Array.from({ length: 9 }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a week mark's place is its identity.
              <Skeleton key={index} shape="sm" className="h-2 w-3" />
            ))}
          </div>
        </div>
        {TRACKS.map((track) => (
          <div key={track.at} className="relative h-28">
            <div className={`absolute top-0 bottom-0 ${track.at}`}>
              <span className="absolute top-4.5 left-4 flex h-5.5 items-center">
                <Skeleton shape="sm" className={`h-3 ${track.name}`} />
              </span>
              <div className="absolute inset-x-0 top-12 h-7.5 rounded-sm border border-border-subtle bg-card" />
              {track.marks.map((mark) => (
                <span
                  key={mark}
                  className={`absolute top-21 flex h-4.5 -translate-x-1/2 items-center ${mark}`}
                >
                  <Skeleton shape="sm" className="h-2.5 w-full" />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
