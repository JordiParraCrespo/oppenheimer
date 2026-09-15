import { PATH_METADATA } from '@nestjs/common/constants';
import { CHECK_POLICIES_KEY, type PolicyRule } from '@oppenheimer/backend-authz';
import { SCREENS, type ScreenRoute } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { AdminController } from '../../admin/admin.controller';
import { FindApiTokensHttpController } from '../../api-tokens/queries/find-api-tokens/find-api-tokens.http.controller';
import { FindSubscriptionsHttpController } from '../../billing/queries/find-subscriptions/find-subscriptions.http.controller';
import { MembersController } from '../../organizations/members.controller';
import { FindRolesHttpController } from '../../roles/queries/find-roles/find-roles.http.controller';

/**
 * The sidebar and the guards must not drift.
 *
 * `SCREENS` (`packages/shared/src/navigation`) is what the web nav gates each
 * row on; `@CheckPolicies` is what the endpoint behind that row actually
 * demands. They used to be two independent declarations of one rule, and two
 * of them can come apart — a screen shown to everyone while the read behind it
 * demands a permission a plain member does not hold is a link that can only
 * answer 403.
 *
 * The nav now reads its policies from `SCREENS`, and this test is the other
 * half: adding, removing or changing a `@CheckPolicies` on one of these
 * handlers fails here until `SCREENS` is brought along with it. Nothing else
 * in the build would notice.
 */

/** The handler each screen's data actually comes from. */
const HANDLERS: Record<ScreenRoute, { controller: object; handler: string }> = {
  '/team': { controller: MembersController, handler: 'list' },
  '/roles': { controller: FindRolesHttpController, handler: 'findAll' },
  '/api-tokens': { controller: FindApiTokensHttpController, handler: 'findAll' },
  '/admin': { controller: AdminController, handler: 'listUsers' },
  '/billing': { controller: FindSubscriptionsHttpController, handler: 'findAll' },
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

describe('the nav catalog and the endpoints behind it', () => {
  for (const [route, { controller, handler }] of Object.entries(HANDLERS) as Array<
    [ScreenRoute, { controller: object; handler: string }]
  >) {
    it(`${route} demands exactly what SCREENS says it does`, () => {
      const declared = SCREENS[route].policies
        .map((policy) => `${policy.action} ${policy.subject}`)
        .sort();

      expect(policiesOn(controller, handler)).toEqual(declared);
    });

    // Without this, pointing a row at the wrong controller would leave the
    // check above passing about a screen it is not looking at.
    it(`${route} is served by the endpoint SCREENS names`, () => {
      expect(pathOf(controller, handler)).toBe(SCREENS[route].endpoint);
    });
  }

  it('covers every screen the nav can offer', () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(Object.keys(SCREENS).sort());
  });
});
