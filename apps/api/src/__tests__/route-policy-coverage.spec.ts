import { describe, expect, it } from 'vitest';
import { fixtureController, scanFixture, scanRoutes } from './route-scopes';

/**
 * Every HTTP route states its authorization intent: `@CheckPolicies` or a reasoned
 * `@NoPolicy`. `PoliciesGuard` fails closed on a route with neither, so this turns that
 * runtime rejection into a build failure. And a `@CheckPolicies` is only checked by
 * `PoliciesGuard`: on a controller that does not run it, the decorator is metadata
 * nobody reads and the route is open to whoever its authentication admits.
 *
 * A source scan (`route-scopes.ts`), not a `DiscoveryService` walk, because booting the
 * app needs a database, Redis and a populated `.env`. It reads decorators with comments
 * blanked out; the integration suite covers the runtime behaviour.
 */

const { routes, unreadable } = scanRoutes();
const describeRoute = (route: (typeof routes)[number]) => `${route.route} (${route.file})`;

describe('route policy coverage', () => {
  it('finds the controllers to check', () => {
    // A scan that silently matches nothing would pass every assertion below.
    expect(routes.length).toBeGreaterThan(150);
  });

  it('reads every controller for certain', () => {
    // A controller the scan refused is a controller none of the checks below saw.
    expect(unreadable).toEqual([]);
  });

  it('declares an authorization policy or a reasoned exemption on every route', () => {
    const undeclared = routes
      .filter((route) => !route.checksPolicies && route.noPolicyReason === undefined)
      .map(describeRoute);

    expect(undeclared).toEqual([]);
  });

  it('never both requires and waives a policy on the same route', () => {
    const contradictory = routes
      .filter((route) => route.checksPolicies && route.noPolicyReason !== undefined)
      .map(describeRoute);

    expect(contradictory).toEqual([]);
  });

  it('gives every exemption a non-trivial reason', () => {
    // The reason is the review artifact. An empty or placeholder string turns
    // the decorator back into the silent default it replaced.
    const weak = routes
      .filter(
        (route) => route.noPolicyReason !== undefined && route.noPolicyReason.trim().length < 15,
      )
      .map((route) => `${describeRoute(route)} -> "${route.noPolicyReason}"`);

    expect(weak).toEqual([]);
  });

  it('runs PoliciesGuard, after ApiAuthGuard, on every route that checks a policy', () => {
    // PoliciesGuard reads the principal ApiAuthGuard leaves on the request, so
    // the order matters as much as the presence.
    const unchecked = routes
      .filter((route) => {
        if (!route.checksPolicies) return false;
        const policies = route.guards.indexOf('PoliciesGuard');
        const auth = route.guards.indexOf('ApiAuthGuard');
        return policies === -1 || auth === -1 || auth > policies;
      })
      .map((route) => `${describeRoute(route)} guards: [${route.guards.join(', ')}]`);

    expect(unchecked).toEqual([]);
  });
});

describe('the policy scan', () => {
  it('ignores a policy decorator that only appears in a comment', () => {
    const { routes } = scanFixture({
      'things.http.controller.ts': fixtureController(
        '  @Get()\n  find() {}',
        [
          '/**',
          " * Unlike its neighbours, this one has no @CheckPolicies({ action: 'read' }).",
          ' */',
          "// @CheckPolicies({ action: 'read', subject: 'Thing' })",
          '@UseGuards(ApiAuthGuard)',
          "@Controller('things')",
        ].join('\n'),
      ),
    });

    expect(routes.map((route) => [route.checksPolicies, route.noPolicyReason])).toEqual([
      [false, undefined],
    ]);
  });

  it('reads class and method guards in the order Nest runs them, and a reason with a comma', () => {
    const { routes, unreadable } = scanFixture({
      'things.http.controller.ts': fixtureController(
        [
          '  @Get()',
          '  @UseGuards(ThingGuard)',
          '  @NoPolicy(\n    "the caller\'s own things, and nothing else",\n  )',
          '  find() {}',
        ].join('\n'),
        "@UseGuards(ApiAuthGuard, PoliciesGuard)\n@Controller('things')",
      ),
    });

    expect(unreadable).toEqual([]);
    expect(routes.map((route) => [route.guards, route.noPolicyReason])).toEqual([
      [
        ['ApiAuthGuard', 'PoliciesGuard', 'ThingGuard'],
        "the caller's own things, and nothing else",
      ],
    ]);
  });

  it('fails closed on a guard list it cannot read for certain', () => {
    const { routes, unreadable } = scanFixture({
      'things.http.controller.ts': fixtureController(
        '  @Get()\n  find() {}',
        "@UseGuards(...GUARDS)\n@Controller('things')",
      ),
    });

    expect(routes).toEqual([]);
    expect(unreadable).toEqual([expect.stringContaining('is not a class name')]);
  });

  it.each([
    ['a reason held in a constant', '@NoPolicy(REASON)', 'is not literal'],
    ['an interpolated reason', '@NoPolicy(`for ${WHO}, always`)', 'is not literal'],
    ['two reasons', "@NoPolicy('one reason, here', 'another')", 'more than one argument'],
    ['no reason', '@NoPolicy()', 'names no reason'],
    ['a reason never closed', "@NoPolicy('the caller's own)", 'is not literal'],
    ['a path holding a quote', '@Get("it\'s")', 'is not literal'],
  ])('fails closed on %s', (_case, decorator, reason) => {
    const verb = decorator.startsWith('@Get') ? decorator : `@Get()\n  ${decorator}`;
    const { routes, unreadable } = scanFixture({
      'things.http.controller.ts': fixtureController(`  ${verb}\n  find() {}`),
    });

    expect(routes).toEqual([]);
    expect(unreadable).toEqual([expect.stringContaining(reason)]);
  });
});
