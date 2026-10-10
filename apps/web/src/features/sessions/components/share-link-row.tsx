import { Badge, Button } from '@oppenheimer/design-system-web';
import type { ShareLink } from '@oppenheimer/frontend-consumer';
import { formatDateTime, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * One live link: what it lets its holder do, who it is for, until when, and
 * Revoke. The secret is not here to copy again: only its digest is kept, so a
 * lost link is revoked and made anew.
 */
export function ShareLinkRow({
  link,
  revoking,
  onRevoke,
}: {
  link: ShareLink;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const audience =
    link.audience === 'people'
      ? link.people.join(', ')
      : t(`sessions.share.audiences.${link.audience}`);
  const until = link.expiresAt
    ? t('sessions.share.until', { date: formatDateTime(link.expiresAt, locale) })
    : t('sessions.share.noExpiry');

  return (
    <li className="flex items-center gap-3 py-2">
      <Badge variant="neutral">
        {link.access === 'write' ? t('sessions.share.writeBadge') : t('sessions.share.readBadge')}
      </Badge>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-fg">{audience}</span>
        <span className="text-xs text-fg-muted">{until}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        pending={revoking}
        pendingLabel={t('sessions.share.revoking')}
        onClick={onRevoke}
      >
        {t('sessions.share.revoke')}
      </Button>
    </li>
  );
}
