import { SidebarInset, SidebarProvider } from '@oppenheimer/design-system-web';
import { useOrganizations } from '@oppenheimer/frontend/react';
import { createFileRoute, Navigate, Outlet, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { AppSidebar } from '@/components/app-shell/app-sidebar';
import { CommandPalette } from '@/components/app-shell/command-palette';
import { TopBar } from '@/components/app-shell/top-bar';
import { useApplyUserSettings } from '@/lib/use-apply-user-settings';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      // `href`, not `pathname`: a deep link's search params are part of where
      // the reader was going (`/settings?section=security`), and dropping them
      // lands them somewhere else after they sign in.
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: AuthenticatedShell,
});

/**
 * The product shell is for people who have somewhere to work.
 *
 * Registering no longer provisions a workspace, so a signed-in account can
 * legitimately belong to none — and the screens in here are scoped to an
 * organization, which for that account is a refusal. Send them to onboarding,
 * where they create their first workspace or accept the invitation that is
 * waiting for them, instead of letting the app tell them on their first screen
 * that they do not have permission to look at it.
 *
 * The redirect waits for a *settled, successful, empty* list. While the query
 * is in flight — including the background refetch that follows creating a
 * workspace or accepting an invitation, when the cache still holds the `[]`
 * that sent them to onboarding — or if it failed, the shell renders as it
 * always did: guessing "nowhere to work" from an unanswered question would
 * bounce every reader out of the app on a network blip, or straight back to
 * the onboarding screen they just left.
 */
function AuthenticatedShell() {
  const organizations = useOrganizations();

  const settledEmpty =
    organizations.isSuccess && !organizations.isFetching && organizations.data.length === 0;

  if (settledEmpty) return <Navigate to="/onboarding" replace />;

  return <AuthenticatedLayout />;
}

/**
 * The workspace shell: sidebar, chrome bar, and a scrolling content column
 * capped at 1080px so a page's measure stays readable on a wide display.
 */
function AuthenticatedLayout() {
  const [commandOpen, setCommandOpen] = useState(false);
  // The saved theme and language become this device's defaults — once, and
  // only where the device has not chosen for itself.
  useApplyUserSettings();

  return (
    <SidebarProvider className="h-svh min-h-0">
      <AppSidebar />
      <SidebarInset className="flex min-h-0 min-w-0 flex-col">
        <TopBar onSearch={() => setCommandOpen(true)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-12 pt-11 pb-16">
          <div className="mx-auto max-w-[1080px]">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </SidebarProvider>
  );
}
