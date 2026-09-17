import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useLogout, useProfile } from '@oppenheimer/frontend-core/react';
import { AppShell, BrandGlyph } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { NAV } from '@/lib/nav';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: ControlPlaneGate,
});

function ControlPlaneGate() {
  const profile = useProfile();

  if (profile.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <Skeleton className="h-32 w-full max-w-md rounded-2xl" />
      </div>
    );
  }

  if (!profile.data?.canAccessControlPlane) return <AccessDenied />;
  return <AuthenticatedLayout />;
}

function AccessDenied() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useLogout({ onSuccess: () => navigate({ to: '/login' }) });

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Alert variant="destructive" className="max-w-md">
        <AlertTitle>{t('control.accessDeniedTitle')}</AlertTitle>
        <AlertDescription>{t('control.accessDeniedDescription')}</AlertDescription>
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          {t('nav.logOut')}
        </Button>
      </Alert>
    </div>
  );
}

function AuthenticatedLayout() {
  return (
    <AppShell nav={NAV} workspace={{ name: 'Oppenheimer Control', icon: <BrandGlyph /> }}>
      <Outlet />
    </AppShell>
  );
}
