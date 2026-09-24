import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { CHECK_POLICIES_KEY, type PolicyRule } from '@oppenheimer/backend-authz';
import { ENDPOINT_POLICIES, type GuardedEndpoint } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { AdminController } from '../../admin/admin.controller';
import { FindApiTokensHttpController } from '../../api-tokens/queries/find-api-tokens/find-api-tokens.http.controller';
import { FindSubscriptionsHttpController } from '../../billing/queries/find-subscriptions/find-subscriptions.http.controller';
import { MembersController } from '../../organizations/members.controller';
import { ArchiveProjectHttpController } from '../../projects/commands/archive-project/archive-project.http.controller';
import { FindProjectHttpController } from '../../projects/queries/find-project/find-project.http.controller';
import { FindProjectsHttpController } from '../../projects/queries/find-projects/find-projects.http.controller';
import { FindRolesHttpController } from '../../roles/queries/find-roles/find-roles.http.controller';
import { AddCheckoutHttpController } from '../../sessions/commands/add-checkout/add-checkout.http.controller';
import { CloseSessionHttpController } from '../../sessions/commands/close-session/close-session.http.controller';
import { IssueAttachTicketHttpController } from '../../sessions/commands/issue-attach-ticket/issue-attach-ticket.http.controller';
import { PasteSessionImageHttpController } from '../../sessions/commands/paste-session-image/paste-session-image.http.controller';
import { RemoveCheckoutHttpController } from '../../sessions/commands/remove-checkout/remove-checkout.http.controller';
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
  'GET /organizations/:orgId/members': { controller: MembersController, handler: 'list' },
  'GET /roles': { controller: FindRolesHttpController, handler: 'findAll' },
  'GET /tokens': { controller: FindApiTokensHttpController, handler: 'findAll' },
  'GET /admin/users': { controller: AdminController, handler: 'listUsers' },
  'GET /billing/subscriptions': { controller: FindSubscriptionsHttpController, handler: 'findAll' },
  'GET /projects': { controller: FindProjectsHttpController, handler: 'list' },
  'GET /projects/:id': { controller: FindProjectHttpController, handler: 'get' },
  'DELETE /projects/:id': { controller: ArchiveProjectHttpController, handler: 'archive' },
  'GET /sessions': { controller: FindSessionsHttpController, handler: 'list' },
  'GET /sessions/:id': { controller: FindSessionHttpController, handler: 'get' },
  'GET /sessions/:id/events': { controller: FindSessionEventsHttpController, handler: 'list' },
  'DELETE /sessions/:id': { controller: CloseSessionHttpController, handler: 'close' },
  'POST /sessions/:id/stop': { controller: StopSessionHttpController, handler: 'stop' },
  'POST /sessions/:id/restart': { controller: RestartSessionHttpController, handler: 'restart' },
  'POST /sessions/:id/checkouts': { controller: AddCheckoutHttpController, handler: 'add' },
  'DELETE /sessions/:id/checkouts/:checkoutId': {
    controller: RemoveCheckoutHttpController,
    handler: 'remove',
  },
  'POST /sessions/:id/attach-ticket': {
    controller: IssueAttachTicketHttpController,
    handler: 'issue',
  },
  'POST /sessions/:id/images': {
    controller: PasteSessionImageHttpController,
    handler: 'paste',
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

/**
 * The endpoint Nest mounts a handler at — method and path, less the global
 * `/api/v{n}` prefix. The method is part of it because the catalog is keyed by it:
 * reading a session and closing one share a route and are not the same endpoint.
 */
function endpointOf(controller: object, handler: string): string {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const method = Reflect.getMetadata(PATH_METADATA, methodOn(controller, handler)) as string;
  const verb = Reflect.getMetadata(METHOD_METADATA, methodOn(controller, handler)) as RequestMethod;
  const path = `/${[base, method].filter((segment) => segment && segment !== '/').join('/')}`;
  return `${RequestMethod[verb]} ${path}`;
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
      expect(endpointOf(controller, handler)).toBe(endpoint);
    });
  }

  it('covers every endpoint in the catalog', () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(Object.keys(ENDPOINT_POLICIES).sort());
  });
});
