import { Avatar, Badge, IconButton } from '@oppenheimer/design-system-web';
import { XIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * One line of Who has access: who, a line about them, what they may do, how
 * long is left, and × to take it back. The owner's line has no ×; the space
 * stays, so the columns line up.
 */
export function ShareAccessRow({
  initials,
  name,
  detail,
  role,
  ends,
  accent,
  onRemove,
  removing,
}: {
  initials: string;
  name: string;
  detail: string;
  role: string;
  ends: string;
  /** The owner's avatar, in the action blue. */
  accent?: boolean;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <li className="flex min-h-13 items-center gap-2.5 py-1.5 pr-2 pl-3 [&+&]:border-t [&+&]:border-border-subtle">
      <Avatar size="sm" variant={accent ? 'accent' : 'neutral'}>
        {initials}
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-sm text-fg">{name}</span>
        <span className="truncate text-xs text-fg-subtle">{detail}</span>
      </span>
      <Badge variant="neutral" className="shrink-0">
        {role}
      </Badge>
      <span className="figures w-18 shrink-0 text-right font-mono text-micro text-fg-subtle">
        {ends}
      </span>
      {onRemove ? (
        <IconButton
          size="sm"
          variant="ghost"
          aria-label={t('sessions.share.removeAccess')}
          title={t('sessions.share.removeAccess')}
          disabled={removing}
          onClick={onRemove}
        >
          <XIcon />
        </IconButton>
      ) : (
        <span aria-hidden className="w-7 shrink-0" />
      )}
    </li>
  );
}
