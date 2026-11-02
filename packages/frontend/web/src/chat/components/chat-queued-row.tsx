import { ComposerStackRow, IconButton } from '@oppenheimer/design-system-web';
import {
  CornerDownLeft,
  CornerDownRight,
  ListEnd,
  Pencil,
  X,
} from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * A message written while the agent worked, waiting on a chat's composer
 * for its turn: its words in one line, then the three things to do with it
 * — send it now; take it back into the field to edit; or drop it. What "now"
 * means is the caller's (into the turn under way, or in place of it), and a
 * caller that cannot offer one of the first two leaves it out. A `steer`
 * waits to go into the turn under way rather than after it (Codex's pending
 * steers over its composer), and says so in its label, whose title says
 * when it goes in.
 */
export function ChatQueuedRow({
  text,
  steer = false,
  onSendNow,
  onEdit,
  onRemove,
}: {
  /** The message, as it will be sent. */
  text: string;
  /** Waiting to go into the turn under way at its next tool call, not after it. */
  steer?: boolean;
  onSendNow?: () => void;
  onEdit?: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ComposerStackRow
      icon={steer ? <CornerDownRight /> : <ListEnd />}
      muted
      actions={
        <>
          {onSendNow ? (
            <IconButton
              size="sm"
              aria-label={t('common.chat.queue.sendNow')}
              title={t('common.chat.queue.sendNow')}
              onClick={onSendNow}
            >
              <CornerDownLeft />
            </IconButton>
          ) : null}
          {onEdit ? (
            <IconButton
              size="sm"
              aria-label={t('common.chat.queue.edit')}
              title={t('common.chat.queue.edit')}
              onClick={onEdit}
            >
              <Pencil />
            </IconButton>
          ) : null}
          <IconButton
            size="sm"
            aria-label={t('common.chat.queue.remove')}
            title={t('common.chat.queue.remove')}
            onClick={onRemove}
          >
            <X />
          </IconButton>
        </>
      }
    >
      {steer ? (
        <strong title={t('common.chat.queue.steerHint')}>{t('common.chat.queue.steer')}</strong>
      ) : (
        <strong>{t('common.chat.queue.queued')}</strong>
      )}{' '}
      <span title={text}>{text}</span>
    </ComposerStackRow>
  );
}
