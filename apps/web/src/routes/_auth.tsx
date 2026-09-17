import { AuthLayout, redirectSignedIn } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context, location }) =>
    redirectSignedIn({
      context,
      location,
      landing: '/sessions',
    }),
  component: ConsumerAuthLayout,
});

function ConsumerAuthLayout() {
  const { t } = useTranslation();

  return (
    <AuthLayout
      links={[
        { to: '/privacy', label: t('public.navigation.privacy') },
        { to: '/terms', label: t('public.navigation.terms') },
      ]}
    >
      <Outlet />
    </AuthLayout>
  );
}
