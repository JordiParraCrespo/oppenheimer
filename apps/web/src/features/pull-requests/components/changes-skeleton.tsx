import { Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Each placeholder file's diff, as the widths of its lines. */
const FILES = [
  ['w-1/3', 'w-1/2', 'w-2/3', 'w-3/5', 'w-1/4', 'w-1/2'],
  ['w-2/5', 'w-3/4', 'w-1/2'],
  ['w-1/2', 'w-2/3', 'w-1/3', 'w-3/5', 'w-2/5'],
];

/** The tree's rows: a folder, then its files, indented. */
const TREE = [
  { depth: 0, width: 'w-28' },
  { depth: 1, width: 'w-32' },
  { depth: 1, width: 'w-28' },
  { depth: 1, width: 'w-36' },
];

/**
 * Changes before the files answer, edge to edge on the card as the diff is:
 * a file's sticky header and its lines, three times, and the file tree at its
 * width beside them with its label written, so the diff and the tree land in
 * their columns.
 */
export function ChangesSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex min-h-0 flex-1 bg-card">
      <LoadingStatus />
      <div aria-hidden className="min-w-0 flex-1 overflow-hidden">
        {FILES.map((lines, file) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a file's place is its identity.
          <div key={file} className="flex flex-col border-b border-border-subtle">
            <div className="flex min-h-11 items-center gap-2 border-b border-border-subtle pr-3 pl-2.5">
              <Skeleton shape="sm" className="size-6" />
              <Skeleton shape="sm" className="size-3.75" />
              <Skeleton shape="sm" className="h-2.5 w-56" />
              <span className="flex-1" />
              <Skeleton shape="sm" className="h-2.5 w-9" />
              <Skeleton shape="pill" className="h-7 w-20" />
            </div>
            <div className="flex flex-col py-2">
              {lines.map((width, line) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a line's place is its identity.
                <div key={line} className="flex h-5 items-center gap-4 pl-3">
                  <Skeleton shape="sm" className="h-2.5 w-4 opacity-60" />
                  <Skeleton shape="sm" className={`h-2.5 ${width}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <aside className="hidden w-80 shrink-0 flex-col gap-2 border-l border-border-subtle px-2.5 pt-3.5 lg:flex">
        <div className="flex items-center justify-between px-1.5">
          <span className="eyebrow">{t('pullRequests.changes.files')}</span>
          <Skeleton shape="sm" className="h-2 w-10" />
        </div>
        <div
          aria-hidden
          className="flex h-8.5 items-center gap-2 rounded-sm border border-border-subtle px-3"
        >
          <Skeleton shape="sm" className="size-3.5" />
          <Skeleton shape="sm" className="h-2.5 w-16 opacity-60" />
        </div>
        <div aria-hidden className="flex flex-col pt-1">
          {TREE.map((row, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: a row's place is its identity.
              key={index}
              className={`flex h-7 items-center gap-2 ${row.depth ? 'pl-7' : 'pl-2'}`}
            >
              <Skeleton shape="sm" className="size-3.5" />
              <Skeleton shape="sm" className={`h-2.5 ${row.width}`} />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
