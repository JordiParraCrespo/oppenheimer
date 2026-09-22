import { isProvisionalSlug } from '@oppenheimer/frontend-consumer';
import { useOrganizations } from '@oppenheimer/frontend-consumer/react';
import { createFileRoute, Navigate, Outlet, redirect, useMatches } from '@tanstack/react-router';
import { isWalkingFirstRun } from '@/features/organizations/lib/first-run';

/**
 * Everything under `/onboarding` is for a signed-in account: the numbered
 * first-run steps. A signed-out visitor is sent to the login page and
 * returned here.
 *
 * `_auth` carries the split screen but no guard, because its other subtree
 * wants the opposite one; this is where the signed-in half is decided. The
 * steps are walked once the account exists, so the terms-and-privacy line
 * under the column would restate what the reader has already agreed to —
 * `legalNoteKey: null` is how a page says "no line". The column is a size up
 * from the forms; `Add your first host` widens it again.
 */
export const Route = createFileRoute('/_auth/onboarding')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: FirstRun,
  staticData: { authWidth: 'wide', legalNoteKey: null },
});

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * Whether this step exists *only* for first-run. The default, and true of
     * the door, the workspace step and Ready: a finished account has no
     * business on any of them, and the gate below sends it to the console.
     *
     * `false` is the two steps that grew a second job. Connect GitHub and Add
     * a host are also the console's only way to fill those gaps — New session
     * links straight here from its empty states and from the host and
     * repository chips — so they stay open for good.
     */
    firstRunOnly?: boolean;
  }
}

/**
 * The flow is shown once (`05-screens.md`), and this is where that holds.
 *
 * It used to hold on step 2 alone, which was the step that could do damage
 * twice: it re-opened the address form over a slug `check-slug` counts as
 * taken, its own. But Ready was left standing, so an account that pressed Back
 * out of the console — or typed the URL — was congratulated on finishing a
 * flow it had finished days ago.
 *
 * "Finished" is not the claim on its own, because two steps run *after* the
 * claim: an account is finished the moment it names its workspace, with
 * Connect GitHub and Add host still in front of it. It is the claim **and**
 * this tab not being mid-walk (`lib/first-run.ts`), which is what tells a
 * reader carrying on from step 2 from one arriving out of nowhere.
 *
 * Only a settled, successful read redirects, for the reason step 2's own gate
 * waits: an unanswered query says nothing about what the account has, and
 * guessing would bounce a reader out of first-run on a network blip.
 */
function FirstRun() {
  // One walk for one key, and the innermost *declaration* wins — a step that
  // says nothing inherits the default rather than reading as `false`.
  const firstRunOnly = useMatches({
    select: (matches) => {
      for (let i = matches.length - 1; i >= 0; i -= 1) {
        const declared = matches[i]?.staticData;
        if (declared && 'firstRunOnly' in declared) return declared.firstRunOnly !== false;
      }
      return true;
    },
  });
  const { data: organizations, isSuccess } = useOrganizations();

  const finished = isSuccess && organizations[0] ? !isProvisionalSlug(organizations[0].slug) : false;

  if (firstRunOnly && finished && !isWalkingFirstRun()) return <Navigate to="/sessions" replace />;

  return <Outlet />;
}
