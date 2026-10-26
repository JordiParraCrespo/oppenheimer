import { ComposerStackRow, IconButton } from '@oppenheimer/design-system-web';
import { CornerDownLeft, ListEnd, Pencil, X } from '@oppenheimer/design-system-web/icons';
import type { ChatQueued } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * A message written while the agent worked, waiting on the composer for its
 * turn to end: its words in one line, then the three things to do with it
 * — send it now, into the turn under way; take it back into the field to
 * edit; or drop it.
 */
export function ChatQueuedRow({
  queued,
  onSendNow,
  onEdit,
  onRemove,
}: {
  queued: ChatQueued;
  onSendNow: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ComposerStackRow
      icon={<ListEnd />}
      muted
      actions={
        <>
          <IconButton
            size="sm"
            aria-label={t('sessions.chat.queue.sendNow')}
            title={t('sessions.chat.queue.sendNow')}
            onClick={onSendNow}
          >
            <CornerDownLeft />
          </IconButton>
          <IconButton
            size="sm"
            aria-label={t('sessions.chat.queue.edit')}
            title={t('sessions.chat.queue.edit')}
            onClick={onEdit}
          >
            <Pencil />
          </IconButton>
          <IconButton
            size="sm"
            aria-label={t('sessions.chat.queue.remove')}
            title={t('sessions.chat.queue.remove')}
            onClick={onRemove}
          >
            <X />
          </IconButton>
        </>
      }
    >
      <strong>{t('sessions.chat.queue.queued')}</strong>{' '}
      <span title={queued.text}>{queued.text}</span>
    </ComposerStackRow>
  );
}
