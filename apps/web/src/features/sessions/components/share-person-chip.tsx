import { Avatar, Chip } from '@oppenheimer/design-system-web';
import { XIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { initialsOf } from '../lib/share-session';

/**
 * One person a session is about to be shared with (`ShareSession.dc.html`):
 * their initials, their address, "outside workspace", and ×. Workspaces are
 * personal for now, so everyone named is outside it.
 */
export function SharePersonChip({ email, onRemove }: { email: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <Chip variant="solid">
      <Avatar size={20}>{initialsOf(email)}</Avatar>
      {email}
      <span className="text-xs font-normal text-fg-subtle">{t('sessions.share.outside')}</span>
      <button
        type="button"
        aria-label={t('sessions.share.removePerson', { name: email })}
        onClick={onRemove}
        className="-mr-1 inline-flex size-5 items-center justify-center rounded-pill text-fg-muted transition-colors duration-fast hover:bg-hover-surface hover:text-fg"
      >
        <XIcon className="size-3" />
      </button>
    </Chip>
  );
}
