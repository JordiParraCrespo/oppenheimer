'use client';

import { FileTree, useFileTree } from '@pierre/trees/react';
import { SearchIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * DiffFileTree — the files a pull request changes, as a tree beside its
 * diff, on @pierre/trees (DiffsHub's tree): folders that hold one folder are
 * flattened into one row (`runner/internal`), each file wears its type mark
 * from the set `FileIcon` draws and its `DiffStat` on the right, and picking
 * one scrolls the diff to it. Above it, the "Files" eyebrow with how many
 * the reader has marked viewed, and a field that narrows the tree as they
 * type.
 *
 * It owns no data: `files` is the changed set, `selected` the file the diff
 * is showing, `onSelect` the pick. The tree draws in its own shadow root;
 * its colours, type and radius are the tokens, passed through its custom
 * properties.
 */

interface DiffTreeFile {
  path: string;
  additions: number;
  deletions: number;
}

const ICON_HUES = ['gray', 'red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'mauve'];

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
  ...Object.fromEntries(ICON_HUES.map((hue) => [`--trees-icon-${hue}`, `var(--file-icon-${hue})`])),
} as React.CSSProperties;

const TREE_CSS =
  '[data-item-section="decoration"]{flex:0 0 auto;padding-inline-start:8px;font-family:var(--font-mono);font-size:12px;font-variant-numeric:tabular-nums}';

function DiffFileTree({
  files,
  selected,
  onSelect,
  viewed,
  labels = {},
  className,
}: {
  files: readonly DiffTreeFile[];
  /** The file the diff is showing. */
  selected?: string;
  onSelect?: (path: string) => void;
  /** Files marked viewed, for "0 / 4 viewed". */
  viewed?: number;
  labels?: { title?: string; viewed?: (done: number, total: number) => string; filter?: string };
  className?: string;
}) {
  const stats = new Map(files.map((file) => [file.path, file]));
  const statsRef = React.useRef(stats);
  const onSelectRef = React.useRef(onSelect);
  React.useEffect(() => {
    // The tree's callbacks are fixed at creation; they read the latest props through these.
    statsRef.current = stats;
    onSelectRef.current = onSelect;
  });

  const { model } = useFileTree({
    paths: files.map((file) => file.path),
    initialExpansion: 'open',
    flattenEmptyDirectories: true,
    initialSelectedPaths: selected ? [selected] : [],
    icons: { set: 'complete', colored: true },
    // The stats are figures, and never give way to a long name.
    unsafeCSS: TREE_CSS,
    fileTreeSearchMode: 'hide-non-matches',
    onSelectionChange: (paths) => {
      const path = paths[0];
      if (path && statsRef.current.has(path)) onSelectRef.current?.(path);
    },
    renderRowDecoration: ({ item }) => {
      const stat = statsRef.current.get(item.path);
      if (!stat) return null;
      const parts = [
        stat.additions > 0 ? { text: `+${stat.additions}${stat.deletions > 0 ? ' ' : ''}`, color: 'var(--success)' } : null,
        stat.deletions > 0 ? { text: `−${stat.deletions}`, color: 'var(--danger)' } : null,
      ].filter((part): part is { text: string; color: string } => part !== null);
      return { text: parts.map((part) => part.text).join(''), parts };
    },
  });

  const paths = files.map((file) => file.path).join('\n');
  React.useEffect(() => {
    // The tree's model is imperative: hand it the changed set when it changes.
    model.resetPaths(paths ? paths.split('\n') : []);
  }, [model, paths]);

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
      <label className="flex h-[34px] items-center gap-2 rounded-sm border border-border-subtle bg-card px-3 text-fg-subtle focus-within:border-primary focus-within:ring-3 focus-within:ring-ring">
        <SearchIcon className="size-3.5 shrink-0" aria-hidden />
        <input
          type="search"
          placeholder={labels.filter ?? 'Filter files'}
          aria-label={labels.filter ?? 'Filter files'}
          onChange={(event) => model.setSearch(event.target.value || null)}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
      </label>
      <FileTree model={model} style={TREE_TOKENS} className="min-h-0 flex-1" />
    </div>
  );
}

export { DiffFileTree };
export type { DiffTreeFile };
