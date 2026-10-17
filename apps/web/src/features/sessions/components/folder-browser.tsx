import {
  Button,
  ChipSelectEmpty,
  ChipSelectItem,
  ChipSelectList,
  IconButton,
} from '@oppenheimer/design-system-web';
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  GitBranch,
  History,
} from '@oppenheimer/design-system-web/icons';
import type { HostFolders } from '@oppenheimer/frontend-consumer';
import { compactAge } from '@oppenheimer/frontend-web';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { folderView } from '../lib/folder-browse';
import { folderInput, leafOf, shortenPath } from '../lib/folder-path';

/**
 * The body of the folder chip's popup (`product/versions/mvp/24-session-places.md`
 * §4, the export's path pane): a path field, the recent folders at the start,
 * the crumbs and the way up, the folders of the one listed, and **Use** with a
 * line saying what opening it does. Typing a path that ends in `/` lists it;
 * anything after the last `/` narrows the list to names that start so.
 *
 * Props in, a path out: the section above reads the host's listing and holds
 * what is typed. Use is on only for a folder the host said exists.
 */
export function FolderBrowser({
  input,
  onInputChange,
  hostName,
  home,
  listing,
  missing,
  loading,
  failure,
  now,
  onUse,
}: {
  input: string;
  onInputChange: (input: string) => void;
  hostName: string;
  /** The host's home, once any listing has said it. */
  home: string | null;
  listing: HostFolders | undefined;
  /** The host said the folder typed does not exist, or is a file. */
  missing: boolean;
  loading: boolean;
  /** Why the host could not list it (offline, an old runner, no answer). */
  failure?: string;
  now: number;
  /** An absolute path on the host. */
  onUse: (path: string) => void;
}) {
  const { t } = useTranslation();
  const view = folderView({ input, home, listing, missing });
  const recent = view.showRecent && !failure ? (listing?.recent ?? []) : [];
  const shown = (path: string) => shortenPath(path, home);

  const emptyText =
    view.empty === 'missing'
      ? t('sessions.new.folder.emptyMissing', { dir: view.dir, host: hostName })
      : view.empty === 'filtered'
        ? t('sessions.new.folder.emptyFiltered', { dir: view.dir, fragment: view.fragment })
        : t('sessions.new.folder.emptyNone');
  const footNote = !view.target
    ? t('sessions.new.folder.footMissing')
    : view.target.branch
      ? t('sessions.new.folder.footRepository', { branch: view.target.branch })
      : t('sessions.new.folder.footFolder');

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (view.target) onUse(view.target.path);
  }

  return (
    <div className="flex min-h-0 flex-col" data-slot="folder-browser">
      <div className="mb-1 flex items-center gap-2 border-b border-border-subtle px-2.5 py-1.5">
        <Folder className="size-3.5 shrink-0 text-fg-subtle" />
        <input
          // biome-ignore lint/a11y/noAutofocus: the path is the reason the popup opened
          autoFocus
          type="text"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('sessions.new.folder.inputPlaceholder')}
          aria-label={t('sessions.new.folder.input')}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent p-0 font-mono text-xs text-fg outline-none placeholder:text-field-placeholder"
        />
        {home ? (
          <span className="shrink-0 truncate text-micro text-fg-subtle">
            {t('sessions.new.folder.homeHint', { home })}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1 px-1 py-0.5">
        {view.up !== null ? (
          <IconButton
            size="sm"
            aria-label={t('sessions.new.folder.up')}
            title={t('sessions.new.folder.up')}
            onClick={() => onInputChange(folderInput(view.up ?? '/'))}
          >
            <ChevronLeft />
          </IconButton>
        ) : null}
        <nav
          aria-label={t('sessions.new.folder.crumbs')}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 font-mono text-xs"
        >
          {view.crumbs.map((crumb, index) => (
            <span key={crumb.dir} className="flex items-center gap-0.5">
              {index > 0 && view.crumbs[index - 1]?.dir !== '/' ? (
                <span className="text-fg-subtle">/</span>
              ) : null}
              <button
                type="button"
                aria-current={index === view.crumbs.length - 1 ? 'location' : undefined}
                onClick={() => onInputChange(folderInput(crumb.dir))}
                className="rounded-sm px-1 py-0.5 text-fg-muted outline-none hover:bg-hover-surface focus-visible:bg-hover-surface aria-[current=location]:text-fg"
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
      </div>

      <ChipSelectList
        role="listbox"
        aria-label={t('sessions.new.folder.label')}
        loading={loading}
        loadingText={t('sessions.new.folder.loading')}
        className="max-h-62"
      >
        {recent.length > 0 ? (
          <div className="mb-1 flex flex-col border-b border-border-subtle pb-1">
            <span className="px-2.5 pt-1.5 pb-1 text-micro font-medium text-fg-subtle uppercase">
              {t('sessions.new.folder.recent', { host: hostName })}
            </span>
            {recent.map((folder) => {
              const age = compactAge(folder.lastUsedAt, now);
              return (
                <ChipSelectItem
                  key={folder.path}
                  leading={<History />}
                  title={folder.path}
                  trailing={
                    <span className="figures shrink-0 font-mono text-micro text-fg-subtle">
                      {age
                        ? t(`common.relative.${age.unit}`, { count: age.count })
                        : t('common.relative.now')}
                    </span>
                  }
                  mono
                  onClick={() => onUse(folder.path)}
                >
                  {shown(folder.path)}
                </ChipSelectItem>
              );
            })}
          </div>
        ) : null}

        {failure ? (
          <ChipSelectEmpty role="alert">{failure}</ChipSelectEmpty>
        ) : view.empty ? (
          <ChipSelectEmpty>{emptyText}</ChipSelectEmpty>
        ) : (
          view.rows.map((entry) => (
            <ChipSelectItem
              key={entry.path}
              leading={<Folder />}
              title={entry.path}
              onClick={() => onInputChange(folderInput(shown(entry.path)))}
              trailing={
                <span className="flex shrink-0 items-center gap-1.5 text-fg-subtle">
                  {entry.branch ? (
                    <span className="flex items-center gap-1 font-mono text-micro">
                      <GitBranch className="size-3" />
                      {entry.branch}
                    </span>
                  ) : null}
                  <ChevronRight className="size-3.5" />
                </span>
              }
            >
              {entry.name}
            </ChipSelectItem>
          ))
        )}
      </ChipSelectList>

      <div className="-mx-1 -mb-1 mt-1 flex items-center gap-2.5 border-t border-border-subtle py-2 pr-2 pl-3">
        <span className="min-w-0 flex-1 text-xs text-fg-subtle">{footNote}</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={!view.target}
          onClick={() => {
            if (view.target) onUse(view.target.path);
          }}
        >
          {view.target
            ? t('sessions.new.folder.use', { name: leafOf(shown(view.target.path)) })
            : t('sessions.new.folder.useNone')}
        </Button>
      </div>
    </div>
  );
}
