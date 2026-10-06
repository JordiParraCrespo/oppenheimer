'use client';

import { SearchIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { BrandGlyph } from './brand-glyph';
import {
  type ChipSelectAction,
  ChipSelectActionRow,
  ChipSelectEmpty,
  ChipSelectItem,
  ChipSelectPopup,
  ChipSelectSearch,
} from './chip-select';
import { IconButton } from './icon-button';
import { Popover, PopoverTrigger } from './popover';

type RepositoryAddOption = {
  id: string;
  /** Mono, as GitHub names it. */
  name: string;
  /** A muted second line: the language, when it was pushed. */
  description?: React.ReactNode;
};

const defaultEmptyText = (query: string): React.ReactNode =>
  query ? `No repository matches “${query}”` : 'Every repository is added';

/**
 * RepositoryAddField — the project dialog's Repositories field
 * (`design/version1/SessionsConsole.dc.html`): a field reading "Add a
 * repository…" that opens the scope chips' pane (search, one row per
 * repository the App can see and the project lacks, the GitHub mark before its
 * mono name), over a 14px card with one row per added repository and an X to
 * take it out. What each repository does in a new session is the Defaults
 * fold's, in `RepositoryRowList`.
 *
 * Ids in, ids out: the caller owns `value` (the ids added, in order) and the
 * label and hint around it. The pane is `ChipSelect`'s parts, as the branch
 * pill's is, so the two repository controls share one picker; `action` is the
 * same pinned foot row ("Manage repository access").
 *
 * ```tsx
 * <RepositoryAddField
 *   repositories={[{ id: 'xrp-mobile', name: 'acme/xrp-mobile', description: 'TypeScript · pushed 3h ago' }]}
 *   value={ids}
 *   onValueChange={setIds}
 * />
 * ```
 */
function RepositoryAddField({
  repositories,
  value,
  onValueChange,
  placeholder = 'Add a repository…',
  emptyText: emptyTextProp,
  removeLabel: removeLabelProp,
  action,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  repositories: RepositoryAddOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: (query: string) => React.ReactNode;
  removeLabel?: (name: string) => string;
  /** A pinned row at the pane's foot, under the list. */
  action?: ChipSelectAction;
}) {
  // Not a default parameter: the React Compiler skips a function-valued one.
  const emptyText = emptyTextProp ?? defaultEmptyText;
  const removeLabel = removeLabelProp ?? ((name: string) => `Remove ${name}`);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const term = query.trim().toLowerCase();
  const byId = new Map(repositories.map((repo) => [repo.id, repo]));
  const added = value.flatMap((id) => {
    const repo = byId.get(id);
    return repo ? [repo] : [];
  });
  const options = repositories.filter(
    (repo) => !value.includes(repo.id) && (term ? repo.name.toLowerCase().includes(term) : true),
  );

  return (
    <div data-slot="repository-add-field" className={cn('flex flex-col gap-2.5', className)} {...props}>
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
              aria-label={placeholder}
              aria-haspopup="listbox"
              data-slot="repository-add-trigger"
              className="flex h-(--control-h-md) w-full items-center gap-2 rounded-sm border border-field-border bg-field px-3 text-left text-operate text-field-placeholder outline-none transition-[border-color,box-shadow] duration-fast ease-standard hover:border-border-strong data-popup-open:border-primary data-popup-open:ring-3 data-popup-open:ring-ring focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring"
            />
          }
        >
          <SearchIcon className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
          {placeholder}
        </PopoverTrigger>
        <ChipSelectPopup width={320} side="bottom" align="start">
          <ChipSelectSearch
            value={query}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div role="listbox" aria-label={placeholder} className="max-h-[220px] overflow-y-auto">
            {options.length > 0 ? (
              options.map((repo) => (
                <ChipSelectItem
                  key={repo.id}
                  leading={<BrandGlyph name="github" className="size-[15px] opacity-70" />}
                  description={repo.description}
                  mono
                  onClick={() => {
                    onValueChange([...value, repo.id]);
                    setQuery('');
                  }}
                >
                  {repo.name}
                </ChipSelectItem>
              ))
            ) : (
              <ChipSelectEmpty>{emptyText(query)}</ChipSelectEmpty>
            )}
          </div>
          {action ? <ChipSelectActionRow action={action} onClose={() => setOpen(false)} /> : null}
        </ChipSelectPopup>
      </Popover>

      {added.length > 0 ? (
        <ul
          data-slot="repository-add-rows"
          className="m-0 flex list-none flex-col rounded-md border border-border-subtle p-0"
        >
          {added.map((repo) => (
            <li
              key={repo.id}
              className="flex min-h-10 items-center gap-2.5 border-t border-border-subtle pr-1.5 pl-3 first:border-t-0"
            >
              <BrandGlyph name="github" className="size-[15px] shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg" title={repo.name}>
                {repo.name}
              </span>
              <IconButton
                size="sm"
                aria-label={removeLabel(repo.name)}
                onClick={() => onValueChange(value.filter((id) => id !== repo.id))}
                className="shrink-0 text-fg-subtle"
              >
                <XIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { RepositoryAddField };
export type { RepositoryAddOption };
