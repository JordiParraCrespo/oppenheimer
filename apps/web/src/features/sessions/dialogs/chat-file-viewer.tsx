import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DiffStat,
  DiffView,
} from '@oppenheimer/design-system-web';
import { useTheme } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { type ChangedFile, pathParts } from '../lib/chat-blocks';
import { patchOfEdits } from '../lib/file-patch';

/**
 * A file a turn changed, read without leaving the chat: what the turn wrote
 * to it, as the diff of its edits. It shows what the transcript carried, so
 * a long edit the host cut says so under the lines.
 */
export function ChatFileViewer({ file, onClose }: { file: ChangedFile; onClose: () => void }) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { name, folder } = pathParts(file.path);
  const patch = patchOfEdits(file.path, file.edits);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-220" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2.5">
            <span className="min-w-0 truncate">{name}</span>
            <DiffStat additions={file.additions} deletions={file.deletions} />
          </DialogTitle>
          {folder ? (
            <DialogDescription className="truncate font-mono" title={file.path}>
              {folder}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {patch ? (
            <DiffView
              patch={patch}
              colorScheme={resolvedTheme}
              className="shrink-0 overflow-hidden rounded-lg border border-border-subtle"
            />
          ) : null}
          {file.truncated || !patch ? (
            <p className="m-0 text-fg-subtle text-xs">
              {t(patch ? 'sessions.chat.fileViewer.truncated' : 'sessions.chat.fileViewer.empty')}
            </p>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
