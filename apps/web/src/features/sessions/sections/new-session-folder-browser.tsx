import { useNow } from '@oppenheimer/design-system-web';
import { useHostFolders, useHosts } from '@oppenheimer/frontend-consumer/react';
import { AppError } from '@oppenheimer/frontend-core';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderBrowser } from '../components/folder-browser';
import { rememberedFolder } from '../lib/folder-memory';
import { expandPath, folderInput, HOME, parseFolderInput, shortenPath } from '../lib/folder-path';

/** The host's answers that mean "there is no folder there", not "the host could not say". */
const MISSING = ['SESSIONS_028', 'SESSIONS_029'];

/**
 * The folder chip's open popup: what is typed, and the host's listing of the
 * folder it names, read now through the runner. Mounted only while the popup
 * is open with a host picked, so a closed chip asks the host nothing.
 *
 * The home listing is read first and always: it is where the picker starts,
 * it says what `~` is, and every answer carries the recent folders. A folder
 * typed under `~` waits for it.
 */
export function NewSessionFolderBrowser({
  hostId,
  value,
  onUse,
}: {
  hostId: string;
  /** The folder the draft holds, where the picker opens. */
  value: string | null;
  onUse: (path: string, home: string | null) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  const [input, setInput] = useState(() =>
    value ? folderInput(shortenPath(value, rememberedFolder(hostId)?.home)) : HOME,
  );
  const { data: hostName } = useHosts({
    select: (hosts) => hosts.find((host) => host.id === hostId)?.name,
  });

  const start = useHostFolders(hostId, null);
  const home = start.data?.home ?? rememberedFolder(hostId)?.home ?? null;
  const { dir } = parseFolderInput(input);
  const absolute = dir === HOME ? null : expandPath(dir, home);
  // A path under `~` before anyone has said where home is: the home read is
  // in flight, and this one waits on it rather than asking for a guess.
  const waiting = absolute === undefined;
  const listing = useHostFolders(hostId, absolute ?? null);

  const error = waiting ? start.error : listing.error;
  const missing = error instanceof AppError && MISSING.includes(error.code);

  return (
    <FolderBrowser
      input={input}
      onInputChange={setInput}
      hostName={hostName ?? t('sessions.provisioning.steps.host.fallback')}
      home={home}
      listing={waiting ? undefined : listing.data}
      missing={missing}
      loading={!error && (waiting || listing.isPending)}
      failure={
        error && !missing ? resolveError(error, t('sessions.new.folder.failed')).message : undefined
      }
      now={now}
      onUse={(path) => onUse(path, home)}
    />
  );
}
