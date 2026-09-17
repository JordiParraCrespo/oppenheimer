import { PageHead } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { RolesList } from '@/features/roles/sections/roles-list';

export function RolesScreen() {
  const { t } = useTranslation();

  return (
    <>
      <PageHead title={t('control.roles.title')} sub={t('control.roles.description')} />
      <RolesList />
    </>
  );
}
