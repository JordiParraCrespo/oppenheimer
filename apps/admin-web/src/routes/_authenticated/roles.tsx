import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PageHead } from '@/components/page-head';
import { RolesTab } from '@/components/role-management/roles-tab';

export const Route = createFileRoute('/_authenticated/roles')({
  component: RolesPage,
});

function RolesPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHead title={t('control.roles.title')} sub={t('control.roles.description')} />
      <RolesTab />
    </>
  );
}
