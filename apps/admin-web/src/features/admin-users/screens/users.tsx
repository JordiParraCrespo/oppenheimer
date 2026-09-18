import { PageHead } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { UsersTable } from '@/features/admin-users/sections/users-table';

/** The control plane's accounts screen: a heading and the table below it. */
export function UsersScreen() {
  const { t } = useTranslation();

  return (
    <>
      <PageHead title={t('control.users.title')} sub={t('control.users.description')} />
      <UsersTable />
    </>
  );
}
