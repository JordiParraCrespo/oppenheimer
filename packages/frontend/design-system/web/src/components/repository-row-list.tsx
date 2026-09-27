'use client';

import { ChevronDownIcon, GitBranchIcon, SearchIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { BrandGlyph } from './brand-glyph';
import { Checkbox } from './checkbox';
import { ChipSelectEmpty, ChipSelectItem, ChipSelectPopup, ChipSelectSearch } from './chip-select';
import { IconButton } from './icon-button';
import { inputVariants } from './input';
import { Popover, PopoverTrigger } from './popover';

/**
 * The project dialog's repositories, in the two places the frame puts them
 * (`design/version1/SessionsConsole.dc.html`, the `proj-title` dialog). Both
 * edit one value — the rows a project holds — and the caller owns it.
 *
 * `RepositoryRowList` is the field: an "Add a repository…" field that opens
 * the searchable pane over the repositories the App can see and not yet
 * chosen, then the chosen ones as mono rows in a 14px card, each with a
 * remove button. An added row is cloned by default and starts on the
 * repository's own default branch. The pane is `ChipSelect`'s — a search row,
 * arrow keys and Enter — on the Popover every picker here is built on,
 * rather than Base UI's Combobox, which would put a second list engine on
 * the console's first load (`scripts/check-bundle-size.mjs`).
 *
 * `RepositoryDefaultRows` is the same rows under the dialog's folding
 * Defaults: a checkbox that says whether new sessions clone it, and a 168px
 * pill for the base branch, which opens the same searchable pane the scope
 * chips use.
 *
 * ```tsx
 * <RepositoryRowList repositories={repos} value={rows} onValueChange={setRows} />
 * <RepositoryDefaultRows repositories={repos} value={rows} onValueChange={setRows} />
 * ```
 */
type RepositoryRowBranch = { value: string; label?: string; description?: string };

type RepositoryRowOption = {
  id: string;
  /** Mono, as GitHub names it. */
  name: string;
  defaultBranch: string;
  branches: RepositoryRowBranch[];
};

type RepositoryRowValue = {
  id: string;
  /** Cloned into every new session of the project. */
  isDefault: boolean;
  /** The base branch sessions start from. */
  branch: string;
};

const defaultEmptyText = (query: string): React.ReactNode =>
  query ? `No repository matches “${query}”.` : 'No repository to add.';
const defaultRemoveLabel = (name: string): string => `Remove ${name}`;
const defaultBranchEmptyText = (query: string): React.ReactNode => `No branch named “${query}”`;
const defaultBranchLabel = (name: string): string => `Base branch for ${name}`;

/** A chosen row's name, as it reads in both lists. */
function nameOf(repositories: readonly RepositoryRowOption[], id: string) {
  return repositories.find((repo) => repo.id === id)?.name ?? id;
}

function RepositoryRowList({
  repositories,
  value,
  onValueChange,
  placeholder = 'Add a repository…',
  emptyText: emptyTextProp,
  removeLabel: removeLabelProp,
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  repositories: RepositoryRowOption[];
  value: RepositoryRowValue[];
  onValueChange: (value: RepositoryRowValue[]) => void;
  placeholder?: string;
  /** The popup's line when nothing is left to add, or nothing matches. */
  emptyText?: (query: string) => React.ReactNode;
  removeLabel?: (name: string) => string;
  disabled?: boolean;
}) {
  // Defaults resolved in the body, not the signature: the React Compiler
  // leaves a component whose default parameter is a function uncompiled.
  const emptyText = emptyTextProp ?? defaultEmptyText;
  const removeLabel = removeLabelProp ?? defaultRemoveLabel;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const chosen = new Set(value.map((row) => row.id));
  const term = query.trim().toLowerCase();
  const available = repositories.filter(
    (repo) => !chosen.has(repo.id) && (term ? repo.name.toLowerCase().includes(term) : true),
  );

  function add(repo: RepositoryRowOption) {
    onValueChange([...value, { id: repo.id, isDefault: true, branch: repo.defaultBranch }]);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, available.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const repo = available[active];
      if (repo) add(repo);
    }
  }

  return (
    <div
      data-slot="repository-row-list"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setActive(0);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger
          disabled={disabled}
          render={
            <button
              type="button"
              aria-haspopup="listbox"
              data-slot="repository-row-list-add"
              className={cn(inputVariants({ size: 'md' }), 'cursor-text text-left text-fg-subtle')}
            />
          }
        >
          <SearchIcon className="size-3.75" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-field-placeholder">{placeholder}</span>
        </PopoverTrigger>
        <ChipSelectPopup style={{ width: 'var(--anchor-width)' }}>
          <ChipSelectSearch
            value={query}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <div role="listbox" aria-label={placeholder}>
            {available.length > 0 ? (
              available.map((repo, index) => (
                <ChipSelectItem
                  key={repo.id}
                  mono
                  highlighted={index === active}
                  leading={<BrandGlyph name="github" size={15} aria-hidden className="opacity-70" />}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => add(repo)}
                >
                  {repo.name}
                </ChipSelectItem>
              ))
            ) : (
              <ChipSelectEmpty className="text-left text-fg-subtle">
                {emptyText(query.trim())}
              </ChipSelectEmpty>
            )}
          </div>
        </ChipSelectPopup>
      </Popover>

      {value.length > 0 ? (
        <div className="flex flex-col rounded-md border border-border-subtle">
          {value.map((row) => {
            const name = nameOf(repositories, row.id);
            return (
              <div
                key={row.id}
                data-slot="repository-row"
                className="flex min-h-10 items-center gap-2.5 border-b border-border-subtle pr-1.5 pl-3 last:border-b-0"
              >
                <BrandGlyph name="github" size={15} aria-hidden className="shrink-0 opacity-70" />
                <span
                  title={name}
                  className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg"
                >
                  {name}
                </span>
                <IconButton
                  type="button"
                  size="sm"
                  variant="quiet"
                  aria-label={removeLabel(name)}
                  disabled={disabled}
                  onClick={() => onValueChange(value.filter((other) => other.id !== row.id))}
                >
                  <XIcon />
                </IconButton>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function RepositoryDefaultRows({
  repositories,
  value,
  onValueChange,
  branchSearchPlaceholder = 'Search branches',
  branchEmptyText: branchEmptyTextProp,
  branchLabel: branchLabelProp,
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  repositories: RepositoryRowOption[];
  value: RepositoryRowValue[];
  onValueChange: (value: RepositoryRowValue[]) => void;
  branchSearchPlaceholder?: string;
  branchEmptyText?: (query: string) => React.ReactNode;
  branchLabel?: (name: string) => string;
  disabled?: boolean;
}) {
  const branchEmptyText = branchEmptyTextProp ?? defaultBranchEmptyText;
  const branchLabel = branchLabelProp ?? defaultBranchLabel;

  function patch(id: string, next: Partial<RepositoryRowValue>) {
    onValueChange(value.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  return (
    <div
      data-slot="repository-default-rows"
      className={cn('flex flex-col rounded-md border border-border-subtle', className)}
      {...props}
    >
      {value.map((row) => {
        const repository = repositories.find((repo) => repo.id === row.id);
        const name = repository?.name ?? row.id;
        const id = `repo-default-${row.id}`;
        return (
          <div
            key={row.id}
            data-slot="repository-default-row"
            data-on={row.isDefault || undefined}
            className="flex min-h-10 items-center gap-3 border-b border-border-subtle py-1.5 pr-2.5 pl-3 last:border-b-0"
          >
            <Checkbox
              id={id}
              checked={row.isDefault}
              disabled={disabled}
              onCheckedChange={(checked) => patch(row.id, { isDefault: checked === true })}
              className="size-4"
            />
            <label
              htmlFor={id}
              title={name}
              className="min-w-0 flex-1 cursor-pointer truncate font-mono text-[12.5px] text-fg"
            >
              {name}
            </label>
            <BranchPill
              branches={repository?.branches ?? []}
              value={row.branch}
              onValueChange={(branch) => patch(row.id, { branch })}
              label={branchLabel(name)}
              searchPlaceholder={branchSearchPlaceholder}
              emptyText={branchEmptyText}
              disabled={disabled}
            />
          </div>
        );
      })}
    </div>
  );
}

/** A row's base branch: the pill, and the searchable pane behind it. */
function BranchPill({
  branches,
  value,
  onValueChange,
  label,
  searchPlaceholder,
  emptyText,
  disabled,
}: {
  branches: RepositoryRowBranch[];
  value: string;
  onValueChange: (branch: string) => void;
  label: string;
  searchPlaceholder: string;
  emptyText: (query: string) => React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const term = query.trim().toLowerCase();
  const shown = branches.filter((branch) =>
    term ? (branch.label ?? branch.value).toLowerCase().includes(term) : true,
  );

  return (
    <div className="relative flex w-42 shrink-0 items-center">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger
          disabled={disabled}
          render={
            <button
              type="button"
              aria-label={label}
              aria-haspopup="listbox"
              data-slot="repository-row-branch"
              className="flex h-7 w-full items-center gap-1.5 rounded-pill bg-hover-surface pr-2 pl-2.5 text-fg-subtle outline-none transition-[background-color,box-shadow] duration-fast ease-standard hover:bg-control-hover data-popup-open:bg-selected-surface data-popup-open:ring-3 data-popup-open:ring-ring focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-50"
            />
          }
        >
          <GitBranchIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left font-mono text-xs text-fg">{value}</span>
          <ChevronDownIcon className="size-3 shrink-0" aria-hidden />
        </PopoverTrigger>
        <ChipSelectPopup width={260} side="bottom" align="start">
          <ChipSelectSearch
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div role="listbox" aria-label={label} className="max-h-55 overflow-y-auto">
            {shown.length > 0 ? (
              shown.map((branch) => (
                <ChipSelectItem
                  key={branch.value}
                  selected={branch.value === value}
                  description={branch.description}
                  mono
                  onClick={() => {
                    onValueChange(branch.value);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {branch.label ?? branch.value}
                </ChipSelectItem>
              ))
            ) : (
              <ChipSelectEmpty className="text-left text-fg-subtle">{emptyText(query)}</ChipSelectEmpty>
            )}
          </div>
        </ChipSelectPopup>
      </Popover>
    </div>
  );
}

export { RepositoryDefaultRows, RepositoryRowList };
export type { RepositoryRowBranch, RepositoryRowOption, RepositoryRowValue };
