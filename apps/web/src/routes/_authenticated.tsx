import { Wordmark } from '@oppenheimer/design-system-web';
import { AppShell, RouteError } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet, redirect, useMatches } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceGate } from '@/features/organizations/sections/workspace-gate';
import { NotFoundScreen } from '@/features/public/screens/not-found';
import { ConsoleRail } from '@/features/sessions/sections/console-rail';
import { SessionsSidebar } from '@/features/sessions/sections/sessions-sidebar';
import { ConsoleDialogProvider, useConsoleList } from '@/lib/console';
import { NAV, USER_MENU } from '@/lib/nav';
import { ConsoleDialogs } from '@/providers/console-dialogs';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * `own`: the route brings its own chrome (Settings), so this layout
     * renders no `AppShell` around it. Absent, the console's shell.
     */
    shell?: 'own';
  }
}

/**
 * The automations sidebar loads with the automations pages, not with the
 * shell: most visits are to sessions, and its trigger catalog and schedule
 * arithmetic have no business on their first load.
 */
const AutomationsSidebar = lazy(() =>
  import('@/features/automations/sections/automations-sidebar').then((module) => ({
    default: module.AutomationsSidebar,
  })),
);

/** The sidebar each of the console's lists shows. */
const SIDEBARS = {
  sessions: <SessionsSidebar />,
  automations: (
    <Suspense fallback={null}>
      <AutomationsSidebar />
    </Suspense>
  ),
};

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      // `href`, not `pathname`: a deep link's search params are part of where
      // the reader was going, and dropping them lands them somewhere else
      // after they sign in.
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: AuthenticatedShell,
  // A 404 keeps the shell. A render error here replaces it, so the panes have
  // the router's `defaultErrorComponent`; this catches what the shell throws.
  errorComponent: RouteError,
  notFoundComponent: NotFoundScreen,
});

/**
 * The console's chrome, behind the workspace gate: the rail, the sidebar the
 * address's list shows, and the dialogs. A `shell: 'own'` route (Settings)
 * passes the same gate and draws its own chrome. The console's dialogs have
 * one owner, here: `ConsoleDialogProvider` holds which is up and
 * `ConsoleDialogs` mounts it; a button only asks.
 */
function AuthenticatedShell() {
  const { t } = useTranslation();
  const ownShell = useMatches({
    select: (matches) => matches.some((match) => match.staticData.shell === 'own'),
  });
  // The list beside the rail is the address's: the same answer the rail
  // lights, so the two never disagree.
  const list = useConsoleList();

  if (ownShell) {
    return (
      <WorkspaceGate>
        <Outlet />
      </WorkspaceGate>
    );
  }

  return (
    <WorkspaceGate>
      <ConsoleDialogProvider>
        <AppShell
          nav={NAV}
          userMenuLinks={USER_MENU}
          rail={<ConsoleRail />}
          sidebar={SIDEBARS[list]}
          // The brand row names the product, not the workspace — version 1 has one
          // workspace per account. `chrome={false}` is the bar, the palette and
          // the foot's hairline; `AppShell` and `use-shell.ts` say why.
          brand={<Wordmark size={18} product={t('common.product')} />}
          chrome={false}
        >
          <Outlet />
        </AppShell>
        <ConsoleDialogs />
      </ConsoleDialogProvider>
    </WorkspaceGate>
  );
}
