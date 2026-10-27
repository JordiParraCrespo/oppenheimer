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
 * members a level shows the first 200 and a button for the rest. The root's
 * members are the first rows, so a fence holding an object and one holding
 * a bare run of `"key": value` pairs read alike; an empty root reads `{}`
 * or `[]`. Hovering a row shows its
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

/** How a container reads at a depth: its members, how many show before the rest is asked for, whether it starts open. */
interface ContainerPlan {
  entries: [string, unknown][];
  cap: number;
  open: boolean;
  inArray: boolean;
}

function planOf(value: Record<string, unknown> | unknown[], depth: number): ContainerPlan {
  const entries = entriesOf(value);
  return {
    entries,
    cap: SHOW_AT_MOST,
    open: depth < OPEN_DEPTH && entries.length <= FOLD_OVER,
    inArray: Array.isArray(value),
  };
}

/** What every row of one tree is drawn with. */
interface TreeOptions {
  annotate: JsonTreeAnnotate | undefined;
  moreLabel: (count: number) => string;
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
  plan,
  path,
  depth,
  options,
}: {
  plan: ContainerPlan;
  path: string;
  depth: number;
  options: TreeOptions;
}) {
  const [all, setAll] = React.useState(false);
  const shown = all ? plan.entries : plan.entries.slice(0, plan.cap);
  const rest = plan.entries.length - shown.length;
  return (
    <>
      {shown.map(([key, child]) => (
        <JsonNode
          key={key}
          name={key}
          index={plan.inArray}
          value={child}
          path={childPath(path, key, plan.inArray)}
          depth={depth}
          options={options}
        />
      ))}
      {rest > 0 ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="ml-5 cursor-pointer rounded-xs px-1 text-fg-muted outline-none hover:bg-hover-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
        >
          {options.moreLabel(rest)}
        </button>
      ) : null}
    </>
  );
}

function JsonNode({
  name,
  index,
  value,
  path,
  depth,
  options,
}: {
  name: string;
  index: boolean;
  value: JsonValue;
  path: string;
  depth: number;
  options: TreeOptions;
}) {
  const plan = isContainer(value) ? planOf(value, depth) : null;
  const [open, setOpen] = React.useState(plan?.open ?? false);
  const row = 'flex min-w-0 items-baseline gap-1.5 rounded-xs pr-1 hover:bg-hover-surface';
  if (!plan || plan.entries.length === 0) {
    const empty = plan ? (plan.inArray ? '[]' : '{}') : null;
    const note = plan ? null : options.annotate?.(value, path);
    return (
      <span data-slot="json-tree-row" title={path} className={cn(row, 'pl-5')}>
        <Key name={name} index={index} />
        {empty ? <span className="text-fg-subtle">{empty}</span> : <Leaf value={value} />}
        {note ? <span className="shrink-0 font-sans text-[12px] text-fg-subtle">{note}</span> : null}
      </span>
    );
  }
  const brackets = plan.inArray ? ['[', ']'] : ['{', '}'];
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
          {plan.entries.length}
          {brackets[1]}
        </span>
      </button>
      {open ? (
        <span className="ml-1.75 block border-l border-border-subtle pl-2">
          <Members plan={plan} path={path} depth={depth + 1} options={options} />
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
  moreLabel = (count) => `Show ${count} more`,
  className,
}: {
  /** A parsed JSON value. */
  value: unknown;
  annotate?: JsonTreeAnnotate;
  /** The button that shows the members past a level's first 200. */
  moreLabel?: (count: number) => string;
  className?: string;
}) {
  const plan = isContainer(value) ? planOf(value, 0) : null;
  return (
    <span data-slot="json-tree" className={cn('block font-mono text-[13px] leading-[1.7] text-fg', className)}>
      {plan && plan.entries.length > 0 ? (
        <Members plan={plan} path="" depth={0} options={{ annotate, moreLabel }} />
      ) : (
        <span className="block pl-5">
          {plan ? <span className="text-fg-subtle">{plan.inArray ? '[]' : '{}'}</span> : <Leaf value={value} />}
        </span>
      )}
    </span>
  );
}

export { JsonTree };
export type { JsonTreeAnnotate };
