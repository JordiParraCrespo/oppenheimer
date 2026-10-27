'use client';

import { ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * JSON read as a tree, the way a browser's devtools draw it: a key in the
 * attribute yellow, a string in green, a number or a literal in orange,
 * `null` muted, the same hues a highlighted fence takes. An object or an
 * array is a row that folds, its size in mono after its key (`{3}`, `[12]`),
 * its members under it on a hairline guide. The first two levels start
 * open, and a container of more than 50 members starts folded; past 200
 * members a level shows the first 200 and a count of the rest. The root's
 * members are the first rows, so a fence holding an object and one holding
 * a bare run of `"key": value` pairs read alike. Hovering a row shows its
 * path (`referral.campaign.startsAt`). `annotate` puts a muted note after a
 * leaf, such as an ISO time read in words.
 *
 * Every element is phrasing content, so the tree can sit in a `pre` (a tool
 * call's output) as well as in a block.
 */

type JsonValue = unknown;

const OPEN_DEPTH = 2;
const FOLD_OVER = 50;
const SHOW_AT_MOST = 200;

const LEAF: Record<string, string> = {
  string: 'text-(--file-icon-green)',
  number: 'text-(--file-icon-orange)',
  boolean: 'text-(--file-icon-orange)',
  bigint: 'text-(--file-icon-orange)',
};

function isContainer(value: JsonValue): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

function entriesOf(value: Record<string, unknown> | unknown[]): [string, unknown][] {
  return Array.isArray(value) ? value.map((item, index) => [String(index), item]) : Object.entries(value);
}

function childPath(path: string, key: string, inArray: boolean): string {
  if (inArray) return `${path}[${key}]`;
  const plain = /^[A-Za-z_$][\w$]*$/.test(key);
  if (!path) return plain ? key : `[${JSON.stringify(key)}]`;
  return plain ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function Leaf({ value }: { value: JsonValue }) {
  if (value === null) return <span className="text-fg-subtle italic">null</span>;
  const text = typeof value === 'string' ? JSON.stringify(value) : String(value);
  return <span className={cn('wrap-anywhere whitespace-pre-wrap', LEAF[typeof value] ?? 'text-fg')}>{text}</span>;
}

function Key({ name, index }: { name: string; index: boolean }) {
  return (
    <span className={index ? 'text-fg-subtle' : 'text-(--file-icon-yellow)'}>
      {index ? name : JSON.stringify(name)}
      <span className="text-fg-subtle">:</span>
    </span>
  );
}

function Members({
  value,
  path,
  depth,
  annotate,
}: {
  value: Record<string, unknown> | unknown[];
  path: string;
  depth: number;
  annotate: JsonTreeAnnotate | undefined;
}) {
  const entries = entriesOf(value);
  const inArray = Array.isArray(value);
  const rest = entries.length - SHOW_AT_MOST;
  return (
    <>
      {entries.slice(0, SHOW_AT_MOST).map(([key, child]) => (
        <JsonNode
          key={key}
          name={key}
          index={inArray}
          value={child}
          path={childPath(path, key, inArray)}
          depth={depth}
          annotate={annotate}
        />
      ))}
      {rest > 0 ? <span className="block pl-5 text-fg-subtle">… +{rest}</span> : null}
    </>
  );
}

function JsonNode({
  name,
  index,
  value,
  path,
  depth,
  annotate,
}: {
  name: string;
  index: boolean;
  value: JsonValue;
  path: string;
  depth: number;
  annotate: JsonTreeAnnotate | undefined;
}) {
  const container = isContainer(value);
  const size = container ? (Array.isArray(value) ? value.length : Object.keys(value).length) : 0;
  const [open, setOpen] = React.useState(depth < OPEN_DEPTH && size <= FOLD_OVER);
  const row = 'flex min-w-0 items-baseline gap-1.5 rounded-xs pr-1 hover:bg-hover-surface';
  if (!container || size === 0) {
    const empty = container ? (Array.isArray(value) ? '[]' : '{}') : null;
    const note = !container ? annotate?.(value, path) : null;
    return (
      <span data-slot="json-tree-row" title={path} className={cn(row, 'pl-5')}>
        <Key name={name} index={index} />
        {empty ? <span className="text-fg-subtle">{empty}</span> : <Leaf value={value} />}
        {note ? <span className="shrink-0 font-sans text-[12px] text-fg-subtle">{note}</span> : null}
      </span>
    );
  }
  const brackets = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return (
    <span data-slot="json-tree-node" className="block">
      <button
        type="button"
        title={path}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(row, 'w-full cursor-pointer text-start outline-none focus-visible:ring-2 focus-visible:ring-ring')}
      >
        <ChevronRightIcon
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 self-center text-fg-subtle transition-transform duration-fast ease-standard',
            open && 'rotate-90',
          )}
        />
        <Key name={name} index={index} />
        <span className="figures text-fg-subtle">
          {brackets[0]}
          {size}
          {brackets[1]}
        </span>
      </button>
      {open ? (
        <span className="ml-1.75 block border-l border-border-subtle pl-2">
          <Members value={value} path={path} depth={depth + 1} annotate={annotate} />
        </span>
      ) : null}
    </span>
  );
}

/** A note after a leaf, from its value and its path; nothing for most. */
type JsonTreeAnnotate = (value: unknown, path: string) => React.ReactNode;

function JsonTree({
  value,
  annotate,
  className,
}: {
  /** A parsed JSON value. */
  value: unknown;
  annotate?: JsonTreeAnnotate;
  className?: string;
}) {
  return (
    <span data-slot="json-tree" className={cn('block font-mono text-[13px] leading-[1.7] text-fg', className)}>
      {isContainer(value) ? (
        <Members value={value} path="" depth={0} annotate={annotate} />
      ) : (
        <span className="block pl-5">
          <Leaf value={value} />
        </span>
      )}
    </span>
  );
}

export { JsonTree };
export type { JsonTreeAnnotate };
