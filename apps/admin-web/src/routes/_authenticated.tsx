import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  SidebarInset,
  SidebarProvider,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useLogout, useProfile } from '@oppenheimer/frontend/react';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSidebar } from '@/components/app-shell/app-sidebar';
import { CommandPalette } from '@/components/app-shell/command-palette';
import { TopBar } from '@/components/app-shell/top-bar';
import { useApplyUserSettings } from '@/lib/use-apply-user-settings';

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
  const [commandOpen, setCommandOpen] = useState(false);
  useApplyUserSettings();

  return (
    <SidebarProvider className="h-svh min-h-0">
      <AppSidebar />
      <SidebarInset className="flex min-h-0 min-w-0 flex-col">
        <TopBar onSearch={() => setCommandOpen(true)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pt-8 pb-16 md:px-12 md:pt-11">
          <div className="mx-auto max-w-[1080px]">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </SidebarProvider>
  );
}
