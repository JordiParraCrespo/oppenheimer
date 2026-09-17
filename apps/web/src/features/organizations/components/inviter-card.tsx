import { Avatar, AvatarFallback } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { initials } from '@/features/organizations/lib/invitation';

/** Who sent the invitation, and what it is for. */
export function InviterCard({
  inviter,
  role,
  email,
}: {
  inviter: string;
  role?: string;
  email?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-7 flex items-center gap-3 rounded-2xl border border-border-subtle p-3.5">
      <Avatar size={38}>
        <AvatarFallback gradient="purple">{initials(inviter)}</AvatarFallback>
      </Avatar>
      <div>
        <div className="text-base font-medium text-ink-900">
          {t('auth.acceptInvitation.invitedYou', { inviter })}
        </div>
        <div className="mt-px text-xs text-ink-400">
          {[role && t('auth.acceptInvitation.joiningAs', { role }), email]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
    </div>
  );
}
