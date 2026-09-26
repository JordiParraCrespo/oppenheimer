'use client';

import { ChevronDownIcon, GitBranchIcon, SearchIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Checkbox } from './checkbox';
import { Chip } from './chip';
import { ChipSelectEmpty, ChipSelectItem, ChipSelectPopup, ChipSelectSearch } from './chip-select';
import { Popover, PopoverTrigger } from './popover';

/**
 * RepositoryRowList — the project dialog's repository picker: a 14px card
 * with a search row on top and one row per repository the App can see. A
 * row is a checkbox and the mono name; once ticked it grows a "Default"
 * toggle chip (cloned into every new session) and a 168px pill for the base
 * branch, which opens the same searchable pane the scope chips use. Untied
 * rows keep the two controls' space but not their ink, so ticking a row
 * never reflows the list.
 *
 * It is a form control, not a menu: the caller owns `value` and renders the
 * label, the help glyph and the "1 of 4 by default" count above it.
 *
 * ```tsx
 * <RepositoryRowList
 *   repositories={[{ id: 'xrp-mobile', name: 'xrp-mobile', defaultBranch: 'main', branches: [...] }]}
 *   value={[{ id: 'xrp-mobile', isDefault: true, branch: 'main' }]}
 *   onValueChange={setRows}
 * />
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

function RepositoryRowList({
  repositories,
  value,
  onValueChange,
  searchPlaceholder = 'Search repositories…',
  emptyText = (query) => `No repository matches “${query}”.`,
  defaultLabel = 'Default',
  defaultTitle = 'Cloned by default in new sessions',
  branchSearchPlaceholder = 'Search branches',
  branchEmptyText = (query) => `No branch named “${query}”`,
  branchLabel = (name) => `Base branch for ${name}`,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  repositories: RepositoryRowOption[];
  value: RepositoryRowValue[];
  onValueChange: (value: RepositoryRowValue[]) => void;
  searchPlaceholder?: string;
  emptyText?: (query: string) => React.ReactNode;
  defaultLabel?: React.ReactNode;
  defaultTitle?: string;
  branchSearchPlaceholder?: string;
  branchEmptyText?: (query: string) => React.ReactNode;
  branchLabel?: (name: string) => string;
}) {
  const [query, setQuery] = React.useState('');
  const term = query.trim().toLowerCase();
  const shown = repositories.filter((repo) => (term ? repo.name.toLowerCase().includes(term) : true));
  const byId = new Map(value.map((row) => [row.id, row]));

  function patch(id: string, next: Partial<RepositoryRowValue> | null) {
    if (next === null) return onValueChange(value.filter((row) => row.id !== id));
    const current = byId.get(id);
    if (current) return onValueChange(value.map((row) => (row.id === id ? { ...row, ...next } : row)));
    const repo = repositories.find((r) => r.id === id);
    if (!repo) return;
    onValueChange([...value, { id, isDefault: true, branch: repo.defaultBranch, ...next }]);
  }

  return (
    <div
      data-slot="repository-row-list"
      className={cn(
        'flex flex-col overflow-hidden rounded-md border border-border-subtle bg-card',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-[7px] border-b border-border-subtle px-3 py-2 text-fg-subtle">
        <SearchIcon className="size-3.5 shrink-0" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
        />
      </div>
      {shown.length === 0 ? (
        <p className="m-0 p-3 text-[12.5px] text-fg-subtle">{emptyText(query)}</p>
      ) : (
        shown.map((repo) => (
          <RepositoryRow
            key={repo.id}
            repository={repo}
            row={byId.get(repo.id)}
            onToggle={(on) => patch(repo.id, on ? {} : null)}
            onDefaultChange={(isDefault) => patch(repo.id, { isDefault })}
            onBranchChange={(branch) => patch(repo.id, { branch })}
            defaultLabel={defaultLabel}
            defaultTitle={defaultTitle}
            branchSearchPlaceholder={branchSearchPlaceholder}
            branchEmptyText={branchEmptyText}
            branchLabel={branchLabel(repo.name)}
          />
        ))
      )}
    </div>
  );
}

function RepositoryRow({
  repository,
  row,
  onToggle,
  onDefaultChange,
  onBranchChange,
  defaultLabel,
  defaultTitle,
  branchSearchPlaceholder,
  branchEmptyText,
  branchLabel,
}: {
  repository: RepositoryRowOption;
  row: RepositoryRowValue | undefined;
  onToggle: (on: boolean) => void;
  onDefaultChange: (isDefault: boolean) => void;
  onBranchChange: (branch: string) => void;
  defaultLabel: React.ReactNode;
  defaultTitle: string;
  branchSearchPlaceholder: string;
  branchEmptyText: (query: string) => React.ReactNode;
  branchLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const on = row !== undefined;
  const term = query.trim().toLowerCase();
  const branches = repository.branches.filter((branch) =>
    term ? (branch.label ?? branch.value).toLowerCase().includes(term) : true,
  );
  const id = `repo-row-${repository.id}`;

  return (
    <div
      data-slot="repository-row"
      data-on={on || undefined}
      className="flex min-h-10 items-center gap-3 border-b border-border-subtle py-1.5 pr-2.5 pl-3 last:border-b-0"
    >
      <Checkbox
        id={id}
        checked={on}
        onCheckedChange={(checked) => onToggle(checked === true)}
        className="size-4"
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer truncate font-mono text-[12.5px] text-fg">
        {repository.name}
      </label>
      <Chip
        selected={row?.isDefault ?? false}
        aria-pressed={row?.isDefault ?? false}
        title={defaultTitle}
        onClick={() => onDefaultChange(!(row?.isDefault ?? false))}
        className={cn('shrink-0', !on && 'invisible')}
      >
        {defaultLabel}
      </Chip>
      <div className={cn('relative flex w-[168px] shrink-0 items-center', !on && 'invisible')}>
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setQuery('');
          }}
        >
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={branchLabel}
                aria-haspopup="listbox"
                data-slot="repository-row-branch"
                className="flex h-7 w-full items-center gap-1.5 rounded-pill bg-hover-surface pr-2 pl-2.5 text-fg-subtle outline-none transition-[background-color,box-shadow] duration-fast ease-standard hover:bg-control-hover data-popup-open:bg-selected-surface data-popup-open:ring-3 data-popup-open:ring-ring focus-visible:ring-3 focus-visible:ring-ring"
              />
            }
          >
            <GitBranchIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left font-mono text-xs text-fg">
              {row?.branch}
            </span>
            <ChevronDownIcon className="size-3 shrink-0" aria-hidden />
          </PopoverTrigger>
          <ChipSelectPopup width={260} side="bottom" align="start">
            <ChipSelectSearch
              value={query}
              placeholder={branchSearchPlaceholder}
              aria-label={branchSearchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div role="listbox" aria-label={branchLabel} className="max-h-[220px] overflow-y-auto">
              {branches.length > 0 ? (
                branches.map((branch) => (
                  <ChipSelectItem
                    key={branch.value}
                    selected={branch.value === row?.branch}
                    description={branch.description}
                    mono
                    onClick={() => {
                      onBranchChange(branch.value);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    {branch.label ?? branch.value}
                  </ChipSelectItem>
                ))
              ) : (
                <ChipSelectEmpty className="text-left text-fg-subtle">{branchEmptyText(query)}</ChipSelectEmpty>
              )}
            </div>
          </ChipSelectPopup>
        </Popover>
      </div>
    </div>
  );
}

export { RepositoryRowList };
export type { RepositoryRowBranch, RepositoryRowOption, RepositoryRowValue };
