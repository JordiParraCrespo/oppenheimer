'use client';

import { ChevronDownIcon, GitBranchIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Checkbox } from './checkbox';
import { ChipSelectEmpty, ChipSelectItem, ChipSelectPopup, ChipSelectSearch } from './chip-select';
import { Popover, PopoverTrigger } from './popover';

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

const defaultBranchEmptyText = (query: string): React.ReactNode => `No branch named “${query}”`;
const defaultBranchLabel = (name: string): string => `Base branch for ${name}`;

/**
 * RepositoryRowList — "Cloned by default", inside the project dialog's
 * Defaults fold (`design/version1/SessionsConsole.dc.html`, `op-prepo`): a
 * 14px card with one 40px row per repository the project holds — a checkbox
 * (ticked, it is cloned into every new session of the project), the mono name,
 * and a 168px base-branch pill opening the scope chips' searchable pane. Which
 * repositories are in the project is `RepositoryAddField`'s to decide.
 *
 * A form control, not a menu: the caller owns `value`, one row per repository
 * in the project's order.
 *
 * ```tsx
 * <RepositoryRowList
 *   repositories={[{ id: 'xrp-mobile', name: 'xrp-mobile', defaultBranch: 'main', branches: [...] }]}
 *   value={[{ id: 'xrp-mobile', isDefault: true, branch: 'main' }]}
 *   onValueChange={setRows}
 * />
 * ```
 */
function RepositoryRowList({
  repositories,
  value,
  onValueChange,
  defaultTitle = 'Cloned by default in new sessions',
  branchSearchPlaceholder = 'Search branches',
  branchEmptyText: branchEmptyTextProp,
  branchLabel: branchLabelProp,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  repositories: RepositoryRowOption[];
  value: RepositoryRowValue[];
  onValueChange: (value: RepositoryRowValue[]) => void;
  defaultTitle?: string;
  branchSearchPlaceholder?: string;
  branchEmptyText?: (query: string) => React.ReactNode;
  branchLabel?: (name: string) => string;
}) {
  // Defaulted here, not in the signature: the React Compiler skips a component
  // whose default parameter is a function.
  const branchEmptyText = branchEmptyTextProp ?? defaultBranchEmptyText;
  const branchLabel = branchLabelProp ?? defaultBranchLabel;
  const byId = new Map(repositories.map((repo) => [repo.id, repo]));

  function patch(id: string, next: Partial<RepositoryRowValue>) {
    onValueChange(value.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  return (
    <div
      data-slot="repository-row-list"
      className={cn('flex flex-col overflow-hidden rounded-md border border-border-subtle', className)}
      {...props}
    >
      {value.map((row) => {
        const repo = byId.get(row.id);
        if (!repo) return null;
        return (
          <RepositoryRow
            key={row.id}
            repository={repo}
            row={row}
            onDefaultChange={(isDefault) => patch(row.id, { isDefault })}
            onBranchChange={(branch) => patch(row.id, { branch })}
            defaultTitle={defaultTitle}
            branchSearchPlaceholder={branchSearchPlaceholder}
            branchEmptyText={branchEmptyText}
            branchLabel={branchLabel(repo.name)}
          />
        );
      })}
    </div>
  );
}

function RepositoryRow({
  repository,
  row,
  onDefaultChange,
  onBranchChange,
  defaultTitle,
  branchSearchPlaceholder,
  branchEmptyText,
  branchLabel,
}: {
  repository: RepositoryRowOption;
  row: RepositoryRowValue;
  onDefaultChange: (isDefault: boolean) => void;
  onBranchChange: (branch: string) => void;
  defaultTitle: string;
  branchSearchPlaceholder: string;
  branchEmptyText: (query: string) => React.ReactNode;
  branchLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const term = query.trim().toLowerCase();
  const branches = repository.branches.filter((branch) =>
    term ? (branch.label ?? branch.value).toLowerCase().includes(term) : true,
  );
  const id = `repo-row-${repository.id}`;

  return (
    <div
      data-slot="repository-row"
      data-on={row.isDefault || undefined}
      className="flex min-h-10 items-center gap-3 border-t border-border-subtle py-1.5 pr-2.5 pl-3 first:border-t-0"
    >
      <Checkbox
        id={id}
        checked={row.isDefault}
        onCheckedChange={(checked) => onDefaultChange(checked === true)}
        title={defaultTitle}
        className="size-4"
      />
      <label
        htmlFor={id}
        className="min-w-0 flex-1 cursor-pointer truncate font-mono text-[12.5px] text-fg"
        title={repository.name}
      >
        {repository.name}
      </label>
      <div className="relative flex w-[168px] shrink-0 items-center">
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
              {row.branch}
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
                    selected={branch.value === row.branch}
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
