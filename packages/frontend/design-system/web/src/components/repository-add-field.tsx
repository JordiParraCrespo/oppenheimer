'use client';

import { SearchIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { BrandGlyph } from './brand-glyph';
import { IconButton } from './icon-button';

/**
 * RepositoryAddField — the project dialog's Repositories field
 * (`design/version1/SessionsConsole.dc.html`): a search input that reads
 * "Add a repository…" and opens, on focus, a listbox of the repositories the
 * App can see that are not yet in the project — the GitHub mark, the mono
 * full name, a muted line under it — and under the input a 14px card with
 * one 40px row per repository added, the mark, the name and a small X to
 * take it out. Nothing else is on a row here: what each repository does in a
 * new session is the Defaults fold's, in `RepositoryRowList`.
 *
 * The caller owns `value` (the ids added, in order) and renders the label
 * and the hint above and below it.
 *
 * ```tsx
 * <RepositoryAddField
 *   repositories={[{ id: 'xrp-mobile', name: 'acme/xrp-mobile', description: 'React Native · updated 3h ago' }]}
 *   value={ids}
 *   onValueChange={setIds}
 * />
 * ```
 */
type RepositoryAddOption = {
  id: string;
  /** Mono, as GitHub names it. */
  name: string;
  /** A muted second line: the language, when it was pushed. */
  description?: React.ReactNode;
};

const defaultEmptyText = (query: string): React.ReactNode =>
  query ? `No repository matches “${query}”` : 'Every repository is added';

function RepositoryAddField({
  repositories,
  value,
  onValueChange,
  placeholder = 'Add a repository…',
  emptyText: emptyTextProp,
  removeLabel: removeLabelProp,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  repositories: RepositoryAddOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: (query: string) => React.ReactNode;
  removeLabel?: (name: string) => string;
}) {
  // Defaults resolved in the body, not the signature: the React Compiler
  // leaves a component whose default parameter is a function uncompiled.
  const emptyText = emptyTextProp ?? defaultEmptyText;
  const removeLabel = removeLabelProp ?? ((name: string) => `Remove ${name}`);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const term = query.trim().toLowerCase();
  const byId = new Map(repositories.map((repo) => [repo.id, repo]));
  const added = value.flatMap((id) => {
    const repo = byId.get(id);
    return repo ? [repo] : [];
  });
  const options = repositories.filter(
    (repo) =>
      !value.includes(repo.id) && (term ? repo.name.toLowerCase().includes(term) : true),
  );
  const listId = React.useId();

  function add(id: string) {
    onValueChange([...value, id]);
    setQuery('');
  }

  return (
    <div data-slot="repository-add-field" className={cn('flex flex-col gap-2.5', className)} {...props}>
      <div className="relative">
        <label className="flex h-(--control-h-md) cursor-text items-center gap-2 rounded-sm border border-field-border bg-field px-3 text-fg-subtle transition-[border-color,box-shadow] duration-fast ease-standard hover:border-border-strong focus-within:border-primary focus-within:ring-3 focus-within:ring-ring">
          <SearchIcon className="size-3.5 shrink-0" aria-hidden />
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={placeholder}
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            // A click on an option fires on mousedown, before the blur.
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
              if (event.key === 'Enter' && options[0]) {
                event.preventDefault();
                add(options[0].id);
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-operate text-fg outline-none placeholder:text-field-placeholder"
          />
        </label>
        {open ? (
          <div
            id={listId}
            role="listbox"
            data-slot="repository-add-list"
            className="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-[264px] overflow-y-auto rounded-md bg-popover p-1 shadow-popover"
          >
            {options.length > 0 ? (
              options.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    add(repo.id);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xs px-2.5 py-[7px] text-left text-[13px] text-fg transition-colors duration-instant ease-standard hover:bg-hover-surface"
                >
                  <BrandGlyph name="github" className="size-[15px] shrink-0 opacity-70" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-mono text-[12.5px]">{repo.name}</span>
                    {repo.description ? (
                      <span className="mt-px text-[11.5px] text-fg-subtle">{repo.description}</span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : (
              <p className="m-0 px-2.5 py-3 text-center text-sm text-fg-subtle">{emptyText(query)}</p>
            )}
          </div>
        ) : null}
      </div>

      {added.length > 0 ? (
        <ul data-slot="repository-add-rows" className="m-0 flex list-none flex-col rounded-md border border-border-subtle p-0">
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
