import { Badge } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** Whether a role is one the seed installs or one this workspace wrote. */
export function RoleTypeBadge({ isSystem }: { isSystem: boolean }) {
  const { t } = useTranslation();

  return (
    <Badge variant="neutral">
      {t(isSystem ? 'pages.team.roles.system' : 'pages.team.roles.custom')}
    </Badge>
  );
}
