import {
  Button,
  DiffComment,
  DiffFile,
  DiffFileHeader,
  type DiffLayout,
  DiffView,
  toast,
} from '@oppenheimer/design-system-web';
import type {
  LineCommentInput,
  PullRequestAddress,
  PullRequestFile,
} from '@oppenheimer/frontend-consumer';
import {
  useAddPullRequestComment,
  usePullRequestComments,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTheme } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DraftComment } from '../components/draft-comment';
import { type DiffNote, type DraftLine, notesOf, toGithubSide } from '../lib/review-draft';
import { patchOf } from '../lib/view';

/**
 * One file of the diff, with what is said on its lines: comments already on
 * GitHub, the review's pending ones, and the one being written from the + on
 * a hovered line. Folding it, marking it viewed and the open draft are this
 * file's own state.
 */
export function ChangesFile({
  address,
  file,
  layout,
  pending,
  onAddPending,
  onDiscardPending,
}: {
  address: PullRequestAddress;
  file: PullRequestFile;
  layout: DiffLayout;
  pending: readonly LineCommentInput[];
  onAddPending: (comment: LineCommentInput) => void;
  onDiscardPending: (index: number) => void;
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const resolveError = useErrorMessage();
  const { data: posted } = usePullRequestComments(address);
  const [collapsed, setCollapsed] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [draft, setDraft] = useState<DraftLine | null>(null);
  const addSingle = useAddPullRequestComment({
    onSuccess: () => {
      setDraft(null);
      toast.success(t('pullRequests.changes.commentAdded'));
    },
    onError: (error) => toast.error(resolveError(error, t('pullRequests.review.failed')).message),
  });
  const notes = notesOf(file.path, posted ?? [], pending, draft);
  const count = notes.filter((note) => note.metadata.kind !== 'draft').length;

  return (
    <DiffFile id={`file-${file.path}`}>
      <DiffFileHeader
        path={file.path}
        additions={file.additions}
        deletions={file.deletions}
        comments={count}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        viewed={viewed}
        onViewedChange={(next) => {
          setViewed(next);
          if (next) setCollapsed(true);
        }}
      />
      {collapsed ? null : file.patch ? (
        <DiffView<DiffNote>
          patch={patchOf({ ...file, patch: file.patch })}
          layout={layout}
          colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          annotations={notes}
          onCommentLine={({ side, lineNumber }) =>
            setDraft({ path: file.path, side: toGithubSide(side), line: lineNumber })
          }
          renderAnnotation={({ metadata }) =>
            metadata.kind === 'draft' && draft ? (
              <DraftComment
                adding={addSingle.isPending}
                onCancel={() => setDraft(null)}
                onAddToReview={(body) => {
                  onAddPending({ ...draft, body });
                  setDraft(null);
                }}
                onAddSingle={(body) => addSingle.mutate({ address, comment: { ...draft, body } })}
              />
            ) : metadata.kind === 'pending' ? (
              <DiffComment
                author={t('pullRequests.review.title')}
                status={t('pullRequests.changes.pending')}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDiscardPending(metadata.index)}
                  >
                    {t('pullRequests.changes.discard')}
                  </Button>
                }
              >
                {metadata.body}
              </DiffComment>
            ) : metadata.kind === 'posted' ? (
              <DiffComment author={`@${metadata.author}`} status={t('pullRequests.changes.posted')}>
                {metadata.body}
              </DiffComment>
            ) : null
          }
        />
      ) : (
        <p className="m-0 px-4 py-3 text-sm text-fg-muted">{t('pullRequests.changes.noPatch')}</p>
      )}
    </DiffFile>
  );
}
