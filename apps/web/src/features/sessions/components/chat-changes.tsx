import { ChangedFileRow, ChangedFilesCard } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChangedFile } from '../lib/chat-blocks';
import { ChatFileViewer } from './chat-file-viewer';

/**
 * What a settled turn changed: the files and their line counts, as Codex
 * closes a turn; one file is its row alone, several under a head with the total.
 * A row opens what the turn wrote to its file.
 */
export function ChatChanges({ files }: { files: ChangedFile[] }) {
  const { t } = useTranslation();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const open = files.find((file) => file.path === openPath);
  return (
    <>
      <ChangedFilesCard
        title={files.length > 1 ? t('sessions.chat.changes', { count: files.length }) : undefined}
        additions={additions}
        deletions={deletions}
      >
        {files.map((file) => (
          <ChangedFileRow
            key={file.path}
            path={file.path}
            additions={file.additions}
            deletions={file.deletions}
            onOpen={() => setOpenPath(file.path)}
          />
        ))}
      </ChangedFilesCard>
      {open ? <ChatFileViewer file={open} onClose={() => setOpenPath(null)} /> : null}
    </>
  );
}
