import { SegmentedControl, SegmentedControlItem, Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_FILE } from '@/features/bots/lib/document-files';
import { BotRevisionsSkeleton } from './bot-revisions-skeleton';

/** The file's opening lines as text falls, a heading, a paragraph, a list, at the editor's line widths. */
const LINES = ['w-1/4', 'w-0', 'w-11/12', 'w-full', 'w-3/5', 'w-0', 'w-2/3', 'w-3/4', 'w-1/2'];

/**
 * Instructions before the documents answer: the file switch as it opens, on
 * INSTRUCTIONS.md with its hint (both are names, not data), the editor's own
 * frame at its 320px floor with a bar per line of mono text, and the revision
 * history's placeholder under it, so nothing moves when the files land.
 */
export function BotDocumentsSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-7">
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      <div aria-hidden className="flex flex-col gap-3">
        <div inert className="flex items-center gap-3">
          <SegmentedControl size="md" value="instructions" onValueChange={() => {}}>
            <SegmentedControlItem value="soul" mono>
              {DOCUMENT_FILE.soul}
            </SegmentedControlItem>
            <SegmentedControlItem value="instructions" mono>
              {DOCUMENT_FILE.instructions}
            </SegmentedControlItem>
          </SegmentedControl>
          <span className="text-sm text-fg-subtle">
            {t('bots.settings.instructions.instructionsHint')}
          </span>
        </div>
        <div className="flex min-h-80 flex-col rounded-lg border border-field-border bg-field px-4.5 py-4">
          {LINES.map((width, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a line's place is its identity.
            <span key={index} className="flex h-[1.65em] items-center text-[13px]">
              {width === 'w-0' ? null : <Skeleton shape="sm" className={`h-2.5 ${width}`} />}
            </span>
          ))}
        </div>
      </div>
      <BotRevisionsSkeleton />
    </div>
  );
}
