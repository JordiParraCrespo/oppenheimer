import { Wordmark } from '@oppenheimer/design-system-web';
import { useOrganizations } from '@oppenheimer/frontend-consumer/react';
import {
  AppShell,
  ConsoleDialogProvider,
  RouteError,
  useConsoleList,
} from '@oppenheimer/frontend-web';
import { createFileRoute, Navigate, Outlet, redirect, useMatches } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { NotFoundScreen } from '@/features/public/screens/not-found';
import { ConsoleRail } from '@/features/sessions/sections/console-rail';
import { SessionsSidebar } from '@/features/sessions/sections/sessions-sidebar';
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
  // Inside the shell, not over it: a 404 or a thrown render keeps the sidebar,
  // so the reader is still in the product with their sessions one click away.
  errorComponent: RouteError,
  notFoundComponent: NotFoundScreen,
});

/**
 * The product shell is for people who have somewhere to work.
 *
 * Sign-up creates the personal workspace, but the hook is best-effort, so a
 * signed-in account can end up belonging to none — and the screens in here
 * are scoped to a workspace, which for that account is a refusal. Send them to
 * onboarding, where they create it, instead of letting the app tell them on
 * their first screen that they do not have permission to look at it.
 *
 * The redirect waits for a *settled, successful, empty* list. While the query
 * is in flight — including the background refetch that follows creating the
 * workspace, when the cache still holds the `[]` that sent them to onboarding
 * — or if it failed, the shell renders as it always did: guessing "nowhere to
 * work" from an unanswered question would bounce every reader out of the app
 * on a network blip, or straight back to the onboarding screen they just left.
 *
 * A `shell: 'own'` route (Settings) passes the same guard and draws its own
 * chrome. The console's dialogs have one owner, here: `ConsoleDialogProvider`
 * holds which is up and `ConsoleDialogs` mounts it; a button only asks.
 */
function AuthenticatedShell() {
  const { t } = useTranslation();
  const organizations = useOrganizations();
  const ownShell = useMatches({
    select: (matches) => matches.some((match) => match.staticData.shell === 'own'),
  });
  // The list beside the rail is the address's: the same answer the rail
  // lights, so the two never disagree.
  const list = useConsoleList();

  const settledEmpty =
    organizations.isSuccess && !organizations.isFetching && organizations.data.length === 0;

  if (settledEmpty) return <Navigate to="/onboarding" replace />;
  if (ownShell) return <Outlet />;

  return (
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
  );
}
