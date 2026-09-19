import { PATH_METADATA } from '@nestjs/common/constants';
import { CHECK_POLICIES_KEY, type PolicyRule } from '@oppenheimer/backend-authz';
import { ENDPOINT_POLICIES, type GuardedEndpoint } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { AdminController } from '../../admin/admin.controller';
import { FindApiTokensHttpController } from '../../api-tokens/queries/find-api-tokens/find-api-tokens.http.controller';
import { FindSubscriptionsHttpController } from '../../billing/queries/find-subscriptions/find-subscriptions.http.controller';
import { MembersController } from '../../organizations/members.controller';
import { FindProjectHttpController } from '../../projects/queries/find-project/find-project.http.controller';
import { FindProjectsHttpController } from '../../projects/queries/find-projects/find-projects.http.controller';
import { FindRolesHttpController } from '../../roles/queries/find-roles/find-roles.http.controller';
import { AddCheckoutHttpController } from '../../sessions/commands/add-checkout/add-checkout.http.controller';
import { IssueAttachTicketHttpController } from '../../sessions/commands/issue-attach-ticket/issue-attach-ticket.http.controller';
import { RestartSessionHttpController } from '../../sessions/commands/restart-session/restart-session.http.controller';
import { StopSessionHttpController } from '../../sessions/commands/stop-session/stop-session.http.controller';
import { FindSessionHttpController } from '../../sessions/queries/find-session/find-session.http.controller';
import { FindSessionEventsHttpController } from '../../sessions/queries/find-session-events/find-session-events.http.controller';
import { FindSessionsHttpController } from '../../sessions/queries/find-sessions/find-sessions.http.controller';

/**
 * The clients and the guards must not drift.
 *
 * `ENDPOINT_POLICIES` (`packages/shared/src/permissions/endpoint-policies.ts`)
 * is what a client gates a destination on; `@CheckPolicies` is what the
 * endpoint behind it actually demands. They used to be two independent
 * declarations of one rule, and two of them can come apart — a screen shown to
 * everyone while the read behind it demands a permission a plain member does
 * not hold is a link that can only answer 403.
 *
 * This is the half that holds the server to it: adding, removing or changing a
 * `@CheckPolicies` on one of these handlers fails here until the catalog is
 * brought along with it, and nothing else in the build would notice. Client
 * route paths are not in it — a nav row names its endpoint where the row
 * lives — so this test needs no frontend package to run.
 */

/** The handler each guarded endpoint's data actually comes from. */
const HANDLERS: Record<GuardedEndpoint, { controller: object; handler: string }> = {
  '/organizations/:orgId/members': { controller: MembersController, handler: 'list' },
  '/roles': { controller: FindRolesHttpController, handler: 'findAll' },
  '/tokens': { controller: FindApiTokensHttpController, handler: 'findAll' },
  '/admin/users': { controller: AdminController, handler: 'listUsers' },
  '/billing/subscriptions': { controller: FindSubscriptionsHttpController, handler: 'findAll' },
  '/projects': { controller: FindProjectsHttpController, handler: 'list' },
  '/projects/:id': { controller: FindProjectHttpController, handler: 'get' },
  '/sessions': { controller: FindSessionsHttpController, handler: 'list' },
  '/sessions/:id': { controller: FindSessionHttpController, handler: 'get' },
  '/sessions/:id/events': { controller: FindSessionEventsHttpController, handler: 'list' },
  // The four write paths whose whole purpose is one action, so the path is the
  // rule. `POST /sessions` is deliberately absent: it shares the listing's path,
  // exactly as renaming a project shares the project read's.
  '/sessions/:id/stop': { controller: StopSessionHttpController, handler: 'stop' },
  '/sessions/:id/restart': { controller: RestartSessionHttpController, handler: 'restart' },
  '/sessions/:id/checkouts': { controller: AddCheckoutHttpController, handler: 'add' },
  '/sessions/:id/attach-ticket': {
    controller: IssueAttachTicketHttpController,
    handler: 'issue',
  },
};

function methodOn(controller: object, handler: string): object {
  const method = (controller as { prototype: Record<string, unknown> }).prototype[handler];
  expect(method, `${handler} must exist on the controller`).toBeTypeOf('function');
  return method as object;
}

/** The rules `@CheckPolicies` recorded on a controller method, order-insensitive. */
function policiesOn(controller: object, handler: string): string[] {
  const rules = (Reflect.getMetadata(CHECK_POLICIES_KEY, methodOn(controller, handler)) ??
    []) as PolicyRule[];
  return rules.map((rule) => `${rule.action} ${rule.subject}`).sort();
}

/** The path Nest mounts a handler at, less the global `/api/v{n}` prefix. */
function pathOf(controller: object, handler: string): string {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const own = Reflect.getMetadata(PATH_METADATA, methodOn(controller, handler)) as string;
  return `/${[base, own].filter((segment) => segment && segment !== '/').join('/')}`;
}

describe('the endpoint policy catalog and the handlers behind it', () => {
  for (const [endpoint, { controller, handler }] of Object.entries(HANDLERS) as Array<
    [GuardedEndpoint, { controller: object; handler: string }]
  >) {
    it(`${endpoint} demands exactly what ENDPOINT_POLICIES says it does`, () => {
      const declared = ENDPOINT_POLICIES[endpoint]
        .map((policy) => `${policy.action} ${policy.subject}`)
        .sort();

      expect(policiesOn(controller, handler)).toEqual(declared);
    });

    // Without this, pointing an entry at the wrong controller would leave the
    // check above passing about an endpoint it is not looking at.
    it(`${endpoint} is served by the handler the catalog names`, () => {
      expect(pathOf(controller, handler)).toBe(endpoint);
    });
  }

  it('covers every endpoint in the catalog', () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(Object.keys(ENDPOINT_POLICIES).sort());
  });
});
