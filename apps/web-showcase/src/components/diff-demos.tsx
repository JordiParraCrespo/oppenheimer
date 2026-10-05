'use client';

import { Avatar, AvatarFallback } from '@oppenheimer/design-system-web/avatar';
import { Button } from '@oppenheimer/design-system-web/button';
import { DiffFileTree } from '@oppenheimer/design-system-web/diff-file-tree';
import {
  type DiffAnnotation,
  DiffComment,
  DiffCommentDraft,
  DiffFile,
  DiffFileHeader,
  type DiffLayout,
  DiffView,
} from '@oppenheimer/design-system-web/diff-view';
import { FileIcon } from '@oppenheimer/design-system-web/file-icon';
import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web/segmented-control';
import * as React from 'react';

import { KEYCHAIN_PATCH, PR_FILES, RECONNECT_PATCH } from './pull-request-fixtures';

type Note = { kind: 'agent'; text: string } | { kind: 'draft' } | { kind: 'mine'; text: string };

/**
 * A pull request's Changes: two files, unified or split, the review agent's
 * pending comment in the first, a person's comment and a new one opened from
 * the + on a hovered line, and the tree beside them.
 */
export function DiffDemo() {
  const [layout, setLayout] = React.useState<DiffLayout>('unified');
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [viewed, setViewed] = React.useState<Record<string, boolean>>({});
  const [selected, setSelected] = React.useState<string>(PR_FILES[0].path);
  const [draft, setDraft] = React.useState('');
  const [notes, setNotes] = React.useState<DiffAnnotation<Note>[]>([
    {
      side: 'additions',
      lineNumber: 87,
      metadata: {
        kind: 'agent',
        text: 'The token file is removed before the keychain writes below are confirmed. A crash between the two loses every token. Write first, then remove.',
      },
    },
  ]);
  const files = [
    { ...PR_FILES[0], patch: KEYCHAIN_PATCH, annotations: notes },
    { ...PR_FILES[3], patch: RECONNECT_PATCH, annotations: [] as DiffAnnotation<Note>[] },
  ];
  const viewedCount = Object.values(viewed).filter(Boolean).length;

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl value={layout} onValueChange={(next) => setLayout(next as DiffLayout)} aria-label="Layout" className="self-start">
        <SegmentedControlItem value="unified">Unified</SegmentedControlItem>
        <SegmentedControlItem value="split">Split</SegmentedControlItem>
      </SegmentedControl>
      <div className="flex h-170 overflow-hidden rounded-lg border border-border-subtle bg-card">
        <div className="min-w-0 flex-1 overflow-y-auto">
          {files.map((file) => (
            <DiffFile key={file.path}>
              <DiffFileHeader
                path={file.path}
                additions={file.additions}
                deletions={file.deletions}
                comments={file.annotations.filter((n) => n.metadata.kind !== 'draft').length}
                collapsed={collapsed[file.path] ?? false}
                onCollapsedChange={(next) => setCollapsed((c) => ({ ...c, [file.path]: next }))}
                viewed={viewed[file.path] ?? false}
                onViewedChange={(next) => setViewed((v) => ({ ...v, [file.path]: next }))}
              />
              {collapsed[file.path] ? null : (
                <DiffView<Note>
                  patch={file.patch}
                  layout={layout}
                  annotations={file.annotations}
                  onCommentLine={
                    file.path === PR_FILES[0].path
                      ? ({ side, lineNumber }) =>
                          setNotes((current) => [...current.filter((n) => n.metadata.kind !== 'draft'), { side, lineNumber, metadata: { kind: 'draft' } }])
                      : undefined
                  }
                  renderAnnotation={({ metadata }) =>
                    metadata.kind === 'draft' ? (
                      <DiffCommentDraft
                        value={draft}
                        onValueChange={setDraft}
                        avatar={<Initials />}
                        onCancel={() => {
                          setDraft('');
                          setNotes((current) => current.filter((n) => n.metadata.kind !== 'draft'));
                        }}
                        onAddToReview={() => {
                          setNotes((current) => current.map((n) => (n.metadata.kind === 'draft' ? { ...n, metadata: { kind: 'mine', text: draft } } : n)));
                          setDraft('');
                        }}
                        onAddSingle={() => {}}
                      />
                    ) : (
                      <DiffComment
                        bot={metadata.kind === 'agent'}
                        avatar={<Initials />}
                        author={metadata.kind === 'agent' ? 'Full-review agent' : 'Jordi Parra'}
                        status="Pending, posts with your review"
                        action={
                          <Button variant="ghost" size="sm">
                            Discard
                          </Button>
                        }
                      >
                        {metadata.text}
                      </DiffComment>
                    )
                  }
                />
              )}
            </DiffFile>
          ))}
        </div>
        <aside className="hidden w-65 shrink-0 border-l border-border-subtle lg:flex">
          <DiffFileTree files={PR_FILES} selected={selected} onSelect={setSelected} viewed={viewedCount} className="w-full" />
        </aside>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-fg-muted">
        {['keychain.go', 'reconnect.ts', 'App.tsx', 'pnpm-lock.yaml', 'README.md', 'install.sh', 'package.json', 'Dockerfile', 'notes.unknown'].map((name) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <FileIcon path={name} />
            <span className="font-mono text-xs">{name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Initials() {
  return (
    <Avatar size="sm">
      <AvatarFallback>JP</AvatarFallback>
    </Avatar>
  );
}
