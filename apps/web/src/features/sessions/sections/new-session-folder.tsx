import { ChipSelectEmpty } from '@oppenheimer/design-system-web';
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useController, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FolderSelect } from '../components/folder-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { rememberedFolder, rememberFolder } from '../lib/folder-memory';
import { shortenPath } from '../lib/folder-path';
import { NewSessionFolderBrowser } from './new-session-folder-browser';
import { NewSessionFolderSearch } from './new-session-folder-search';

/**
 * The folder chip, bound to the draft: a folder already on the host, opened as
 * it is (`product/versions/mvp/24-session-places.md` §4). The host's folders
 * are read only while the popup is open, by the browser it draws; the chip
 * itself names the folder from what this host's last pick remembered, `~/…`
 * under its home. A `?path=` under `~` is resolved against the host's home by
 * a section of its own, the one read made with the popup shut.
 */
export function NewSessionFolder() {
  const { t } = useTranslation();
  const search = useSearch({ from: '/_authenticated/sessions/new' });
  const { control } = useNewSessionDraft();
  const hostId = useWatch({ control, name: 'hostId' });
  const { field } = useController({ control, name: 'folder' });
  const [open, setOpen] = useState(false);

  const home = hostId ? (rememberedFolder(hostId)?.home ?? null) : null;

  function use(path: string, hostHome: string | null) {
    if (hostId) rememberFolder(hostId, { path, home: hostHome });
    field.onChange(path);
    setOpen(false);
  }

  return (
    <>
      {hostId && search.path?.startsWith('~') ? (
        <NewSessionFolderSearch
          hostId={hostId}
          path={search.path}
          onResolved={(path, hostHome) => {
            rememberFolder(hostId, { path, home: hostHome });
            field.onChange(path);
          }}
        />
      ) : null}
      <FolderSelect
        label={field.value ? shortenPath(field.value, home) : null}
        title={field.value ?? undefined}
        open={open}
        onOpenChange={setOpen}
        variant="tab"
      >
        {hostId ? (
          <NewSessionFolderBrowser hostId={hostId} value={field.value} onUse={use} />
        ) : (
          <ChipSelectEmpty>{t('sessions.new.folder.noHost')}</ChipSelectEmpty>
        )}
      </FolderSelect>
    </>
  );
}
