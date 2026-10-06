import {
  DiffFileTree,
  type DiffLayout,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
} from '@oppenheimer/design-system-web';
import type { LineCommentInput, PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { usePullRequestFiles } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChangesFile } from './changes-file';

/**
 * Changes: every file's diff, unified or split, and the tree beside it. The
 * view is the whole pane: the diff scrolls in its column under each file's
 * sticky header while the tree stays put. A comment added to the review stays
 * pending here, with the screen, until the review is submitted.
 */
export function PullRequestChanges({
  address,
  pending,
  onAddPending,
  onDiscardPending,
}: {
  address: PullRequestAddress;
  pending: readonly LineCommentInput[];
  onAddPending: (comment: LineCommentInput) => void;
  onDiscardPending: (index: number) => void;
}) {
  const { t } = useTranslation();
  const files = usePullRequestFiles(address);
  const [layout, setLayout] = useState<DiffLayout>('unified');
  const [selected, setSelected] = useState<string | undefined>(undefined);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-6 pb-4 sm:px-8">
      <QueryState
        query={files}
        pending={<Skeleton className="min-h-0 w-full flex-1" />}
        errorFallback={t('pullRequests.changes.loadFailed')}
        empty={{
          when: (rows) => rows.length === 0,
          show: <p className="m-0 text-sm text-fg-muted">{t('pullRequests.changes.empty')}</p>,
        }}
      >
        {(rows) => (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <SegmentedControl
              value={layout}
              onValueChange={(next) => setLayout(next as DiffLayout)}
              aria-label={t('pullRequests.changes.layout')}
              className="self-start"
            >
              <SegmentedControlItem value="unified">
                {t('pullRequests.changes.unified')}
              </SegmentedControlItem>
              <SegmentedControlItem value="split">
                {t('pullRequests.changes.split')}
              </SegmentedControlItem>
            </SegmentedControl>
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border-subtle bg-card">
              <div className="min-w-0 flex-1 overflow-y-auto">
                {rows.map((file) => (
                  <ChangesFile
                    key={file.path}
                    address={address}
                    file={file}
                    layout={layout}
                    pending={pending}
                    onAddPending={onAddPending}
                    onDiscardPending={onDiscardPending}
                  />
                ))}
              </div>
              <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border-subtle lg:flex">
                <DiffFileTree
                  files={rows}
                  selected={selected}
                  onSelect={(path) => {
                    setSelected(path);
                    document
                      .getElementById(`file-${path}`)
                      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                  }}
                  labels={{
                    title: t('pullRequests.changes.files'),
                    filter: t('pullRequests.changes.filter'),
                    viewed: (done, total) => t('pullRequests.changes.viewed', { done, total }),
                  }}
                  className="w-full"
                />
              </aside>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}
