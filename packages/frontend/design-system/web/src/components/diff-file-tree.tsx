'use client';

import { FileTree, useFileTree } from '@pierre/trees/react';
import { SearchIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { diffStatParts } from './diff-stat';

/**
 * DiffFileTree — the files a pull request changes, as a tree beside its
 * diff, on @pierre/trees (DiffsHub's tree): folders that hold one folder are
 * flattened into one row (`runner/internal`), each file wears its type mark
 * from the set `FileIcon` draws and its stat on the right, printed as
 * `DiffStat` prints it, and picking one scrolls the diff to it. Above it,
 * the "Files" eyebrow with how many the reader has marked viewed, and a
 * field that narrows the tree as they type.
 *
 * It owns no data: `files` is the changed set, `selected` the file the diff
 * is showing, `onSelect` the pick. The tree's model is built from `files`
 * and rebuilt when the caller hands a new `files`; that is its only write.
 * It draws in its own shadow root; its colours, type and radius are the
 * tokens, passed through its custom properties (its type marks' hues from
 * the `--file-icon-*` map in the stylesheet).
 */

interface DiffTreeFile {
  path: string;
  additions: number;
  deletions: number;
}

/** The tree's custom properties, pointed at the tokens. */
const TREE_TOKENS = {
  '--trees-bg-override': 'transparent',
  '--trees-fg-override': 'var(--fg)',
  '--trees-fg-muted-override': 'var(--fg-muted)',
  '--trees-bg-muted-override': 'var(--hover-surface)',
  '--trees-selected-bg-override': 'var(--hover-surface)',
  '--trees-selected-fg-override': 'var(--fg)',
  '--trees-selected-focused-border-color-override': 'transparent',
  '--trees-accent-override': 'var(--primary)',
  '--trees-focus-ring-color-override': 'var(--ring)',
  '--trees-border-color-override': 'var(--border-subtle)',
  '--trees-border-radius-override': 'var(--radius-sm)',
  '--trees-font-family-override': 'var(--font-sans)',
  '--trees-font-size-override': '13px',
  '--trees-indent-guide-bg-override': 'transparent',
  // A level steps in 14px, as the frames do; the library's wider step cut names short.
  '--trees-level-gap-override': '6px',
} as React.CSSProperties;

/** The stats are figures, and never give way to a long name. */
const TREE_CSS =
  '[data-item-section="decoration"]{flex:0 0 auto;padding-inline-start:8px;font-family:var(--font-mono);font-size:12px;font-variant-numeric:tabular-nums}';

/** A stable key per `files` array, so a new set builds a new model. */
const keys = new WeakMap<readonly DiffTreeFile[], number>();
let nextKey = 0;
function keyOf(files: readonly DiffTreeFile[]) {
  let key = keys.get(files);
  if (key === undefined) {
    key = nextKey++;
    keys.set(files, key);
  }
  return key;
}

function DiffFileTree({
  files,
  selected,
  onSelect,
  viewed,
  labels = {},
  className,
}: {
  /** The changed set; hand a new array when it changes. */
  files: readonly DiffTreeFile[];
  /** The file the diff is showing. */
  selected?: string;
  onSelect?: (path: string) => void;
  /** Files marked viewed, for "0 / 4 viewed". */
  viewed?: number;
  labels?: { title?: string; viewed?: (done: number, total: number) => string; filter?: string };
  className?: string;
}) {
  return (
    <div data-slot="diff-file-tree" className={cn('flex min-h-0 flex-col gap-2 px-2.5 pt-3.5', className)}>
      <div className="flex items-center justify-between px-1.5">
        <span className="eyebrow">{labels.title ?? 'Files'}</span>
        {viewed !== undefined ? (
          <span className="figures text-micro text-fg-subtle">
            {labels.viewed?.(viewed, files.length) ?? `${viewed} / ${files.length} viewed`}
          </span>
        ) : null}
      </div>
      <Tree key={keyOf(files)} files={files} selected={selected} onSelect={onSelect} filter={labels.filter ?? 'Filter files'} />
    </div>
  );
}

/** One model, built from one `files`. */
function Tree({
  files,
  selected,
  onSelect,
  filter,
}: {
  files: readonly DiffTreeFile[];
  selected?: string;
  onSelect?: (path: string) => void;
  filter: string;
}) {
  const stats = new Map(files.map((file) => [file.path, file]));
  // The model fixes its callbacks when it is built; the pick reads the latest handler.
  const pick = React.useEffectEvent((path: string) => onSelect?.(path));
  const { model } = useFileTree({
    paths: files.map((file) => file.path),
    initialExpansion: 'open',
    flattenEmptyDirectories: true,
    initialSelectedPaths: selected ? [selected] : [],
    icons: { set: 'complete', colored: true },
    unsafeCSS: TREE_CSS,
    fileTreeSearchMode: 'hide-non-matches',
    onSelectionChange: (paths) => {
      const path = paths[0];
      if (path && stats.has(path)) pick(path);
    },
    renderRowDecoration: ({ item }) => {
      const stat = stats.get(item.path);
      if (!stat) return null;
      const parts = diffStatParts(stat.additions, stat.deletions).map((part, i) => ({
        text: i > 0 ? ` ${part.text}` : part.text,
        color: part.side === 'additions' ? 'var(--success)' : 'var(--danger)',
      }));
      return { text: parts.map((part) => part.text).join(''), parts };
    },
  });
  return (
    <>
      <label className="flex h-[34px] items-center gap-2 rounded-sm border border-border-subtle bg-card px-3 text-fg-subtle focus-within:border-primary focus-within:ring-3 focus-within:ring-ring">
        <SearchIcon className="size-3.5 shrink-0" aria-hidden />
        <input
          type="search"
          placeholder={filter}
          aria-label={filter}
          onChange={(event) => model.setSearch(event.target.value || null)}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
      </label>
      <FileTree model={model} style={TREE_TOKENS} className="min-h-0 flex-1" />
    </>
  );
}

export { DiffFileTree };
export type { DiffTreeFile };
