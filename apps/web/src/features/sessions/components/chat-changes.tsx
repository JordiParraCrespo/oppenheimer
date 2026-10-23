import { ChangedFileRow, ChangedFilesCard } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import type { ChangedFile } from '../lib/chat-blocks';

/** What a settled turn changed: the files and their line counts, as Codex closes a turn. */
export function ChatChanges({ files }: { files: ChangedFile[] }) {
  const { t } = useTranslation();
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  return (
    <ChangedFilesCard
      title={t('sessions.chat.changes', { count: files.length })}
      additions={additions}
      deletions={deletions}
    >
      {files.map((file) => (
        <ChangedFileRow
          key={file.path}
          path={file.path}
          additions={file.additions}
          deletions={file.deletions}
        />
      ))}
    </ChangedFilesCard>
  );
}
