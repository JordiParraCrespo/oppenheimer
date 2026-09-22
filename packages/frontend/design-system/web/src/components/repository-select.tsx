'use client';

import { ChevronRightIcon, FolderIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import {
  ChipSelectActionRow,
  ChipSelectBack,
  ChipSelectEmpty,
  ChipSelectItem,
  ChipSelectLoading,
  ChipSelectPopup,
  ChipSelectSearch,
  ChipSelectTrigger,
} from './chip-select';
import { Popover, PopoverTrigger } from './popover';

/**
 * RepositorySelect — the repository chip on New session. A session can span
 * several repositories, so this picker multi-selects: rows toggle in and out,
 * and the chip reads the first one plus a count ("xrp-mobile +1").
 *
 * A branch belongs to a repository, so each **selected** row grows a right-hand
 * cell (134px, hairline on its left, mono) showing that repo's branch with a
 * chevron. Clicking it swaps the same 318px popup to a branch pane for that
 * repo: a back row, its own search, mono branch options. Picking a branch
 * returns to the repository list, so the next repo's branch is one click away.
 *
 * Adding a repository lands it on its default branch; removing it forgets its
 * branch, so re-adding it never resurrects a stale choice. The caller decides
 * whether a sibling branch chip is shown: only while exactly one repository is
 * selected does a branch chip tell the truth.
 *
 * ```tsx
 * <RepositorySelect
 *   repositories={repos}
 *   value={scope}            // [{ id: 'xrp-mobile', branch: 'main' }]
 *   onValueChange={setScope}
 *   action={{ label: 'Add repository…', onSelect: connectMore }}
 * />
 * ```
 */
type RepositoryBranch = { value: string; label?: string };

type RepositoryOption = {
  id: string;
  /** Shown in the row and the chip ("xrp-mobile"). */
  name: string;
  /** The muted second line ("updated 3h ago"). */
  description?: string;
  /** Extra words the search matches on ("JordiParraCrespo"). */
  keywords?: string;
  branches: RepositoryBranch[];
  /** Falls back to the first branch. */
  defaultBranch?: string;
};

type RepositoryScope = { id: string; branch: string };

function defaultBranchOf(repo: RepositoryOption) {
  return repo.defaultBranch ?? repo.branches[0]?.value ?? 'main';
}

function RepositorySelect({
  repositories,
  value,
  onValueChange,
  icon,
  placeholder = 'Repository',
  searchPlaceholder = 'Search repositories…',
  branchSearchPlaceholder = 'Search branches…',
  emptyText = 'No repository matches.',
  branchEmptyText = 'No branch matches.',
  loading = false,
  loadingText = 'Loading…',
  branchPaneTitle = (name) => `Branch for ${name}`,
  changeBranchLabel = 'Change branch',
  action,
  disabled,
  className,
  'aria-label': ariaLabel = 'Repositories',
}: {
  repositories: RepositoryOption[];
  value: RepositoryScope[];
  onValueChange: (value: RepositoryScope[]) => void;
  icon?: React.ReactNode;
  placeholder?: React.ReactNode;
  searchPlaceholder?: string;
  branchSearchPlaceholder?: string;
  emptyText?: string;
  branchEmptyText?: string;
  /** The repositories are still being fetched: the chip stays live and says so. */
  loading?: boolean;
  loadingText?: string;
  branchPaneTitle?: (repoName: string) => React.ReactNode;
  changeBranchLabel?: string;
  action?: { label: string; icon?: React.ReactNode; onSelect: () => void };
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [pane, setPane] = React.useState<string | null>(null);
  const term = query.trim().toLowerCase();

  const byId = new Map(repositories.map((repo) => [repo.id, repo]));
  const selectedIds = value.map((scope) => scope.id);
  const primary = value[0] ? byId.get(value[0].id) : undefined;
  const paneRepo = pane ? byId.get(pane) : undefined;

  const label = primary ? (
    <>
      {primary.name}
      {value.length > 1 ? (
        <span className="ml-1.5 text-fg-muted">+{value.length - 1}</span>
      ) : null}
    </>
  ) : null;

  const visibleRepos = repositories.filter((repo) =>
    term
      ? `${repo.name} ${repo.description ?? ''} ${repo.keywords ?? ''}`.toLowerCase().includes(term)
      : true,
  );
  const visibleBranches = (paneRepo?.branches ?? []).filter((branch) =>
    term ? (branch.label ?? branch.value).toLowerCase().includes(term) : true,
  );

  function toggle(repo: RepositoryOption) {
    if (selectedIds.includes(repo.id)) {
      onValueChange(value.filter((scope) => scope.id !== repo.id));
    } else {
      onValueChange([...value, { id: repo.id, branch: defaultBranchOf(repo) }]);
    }
  }

  function chooseBranch(branch: string) {
    if (!pane) return;
    onValueChange(value.map((scope) => (scope.id === pane ? { ...scope, branch } : scope)));
    setPane(null);
    setQuery('');
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setPane(null);
        }
      }}
    >
      <PopoverTrigger
        render={
          <ChipSelectTrigger
            icon={icon ?? <FolderIcon />}
            open={open}
            placeholder={placeholder}
            aria-label={ariaLabel}
            disabled={disabled}
            className={className}
          >
            {label}
          </ChipSelectTrigger>
        }
      />
      <ChipSelectPopup width={318} maxHeight={264}>
        {paneRepo ? (
          <>
            <ChipSelectBack
              onClick={() => {
                setPane(null);
                setQuery('');
              }}
            >
              {branchPaneTitle(paneRepo.name)}
            </ChipSelectBack>
            <ChipSelectSearch
              value={query}
              placeholder={branchSearchPlaceholder}
              aria-label={branchSearchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div role="listbox" aria-label={String(branchPaneTitle(paneRepo.name))}>
              {visibleBranches.length > 0 ? (
                visibleBranches.map((branch) => (
                  <ChipSelectItem
                    key={branch.value}
                    mono
                    selected={value.find((scope) => scope.id === pane)?.branch === branch.value}
                    onClick={() => chooseBranch(branch.value)}
                  >
                    {branch.label ?? branch.value}
                  </ChipSelectItem>
                ))
              ) : (
                <ChipSelectEmpty>{branchEmptyText}</ChipSelectEmpty>
              )}
            </div>
          </>
        ) : (
          <>
            <ChipSelectSearch
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div role="listbox" aria-multiselectable aria-label={ariaLabel}>
              {visibleRepos.length === 0 && loading ? (
                <ChipSelectLoading>{loadingText}</ChipSelectLoading>
              ) : visibleRepos.length > 0 ? (
                visibleRepos.map((repo) => {
                  const scope = value.find((item) => item.id === repo.id);
                  return (
                    <div
                      key={repo.id}
                      data-slot="repository-row"
                      data-selected={scope ? '' : undefined}
                      className="flex items-stretch overflow-hidden rounded-sm"
                    >
                      <ChipSelectItem
                        selected={Boolean(scope)}
                        description={repo.description}
                        className="min-w-0 flex-1"
                        onClick={() => toggle(repo)}
                      >
                        {repo.name}
                      </ChipSelectItem>
                      {scope ? (
                        <button
                          type="button"
                          aria-label={`${changeBranchLabel}: ${repo.name}`}
                          title={changeBranchLabel}
                          data-slot="repository-branch-cell"
                          onClick={() => {
                            setPane(repo.id);
                            setQuery('');
                          }}
                          className={cn(
                            'figures flex w-[134px] shrink-0 items-center justify-between gap-1 border-l border-border-subtle px-2.5 text-[11px] tracking-[-0.004em] text-fg-subtle outline-none transition-colors duration-fast hover:bg-hover-surface hover:text-fg focus-visible:bg-hover-surface focus-visible:text-fg',
                          )}
                        >
                          <span className="min-w-0 truncate">{scope.branch}</span>
                          <ChevronRightIcon className="size-[11px] shrink-0 opacity-70" strokeWidth={2.2} />
                        </button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <ChipSelectEmpty>{emptyText}</ChipSelectEmpty>
              )}
            </div>
            {action ? (
              <ChipSelectActionRow
                icon={action.icon}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
              >
                {action.label}
              </ChipSelectActionRow>
            ) : null}
          </>
        )}
      </ChipSelectPopup>
    </Popover>
  );
}

export { RepositorySelect };
export type { RepositoryBranch, RepositoryOption, RepositoryScope };
