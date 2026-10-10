import type { HttpMetricsOptions } from '@oppenheimer/backend-core';

/**
 * Which `route` label each API route records under. Groups follow the product's
 * areas, not its URLs, so the label set stays under the budget
 * `HttpMetricsModule.register` enforces whatever the route count grows to; a
 * new controller under a known prefix is classified without an edit here, and
 * one under a new prefix fails `http-metrics.config.spec.ts` until it is given
 * a group.
 *
 * `events` (the console's server-sent change feed) and `webhooks` are their
 * own groups because their latency means something else: a stream is open
 * for as long as the tab is, and a webhook's caller is GitHub, not a person.
 */
export const apiHttpMetricsOptions: HttpMetricsOptions = {
  prefix: '/api',
  // The probes and the scrape itself: recording them would measure the
  // monitoring, and every scrape would change what it scrapes.
  excludedTemplates: ['/v1/health', '/v1/ready', '/v1/metrics'],
  routes: [
    { templatePrefix: '/v1/health/capabilities', group: 'capabilities' },
    { templatePrefix: '/v1/events', group: 'events' },
    { templatePrefix: '/v1/github/webhook', group: 'webhooks' },
    { templatePrefix: '/v1/sessions', group: 'sessions' },
    { templatePrefix: '/v1/shared-sessions', group: 'sessions' },
    { templatePrefix: '/v1/hosts', group: 'hosts' },
    { templatePrefix: '/v1/projects', group: 'projects' },
    { templatePrefix: '/v1/automations', group: 'automations' },
    { templatePrefix: '/v1/automation-runs', group: 'automations' },
    { templatePrefix: '/v1/automation-settings', group: 'automations' },
    { templatePrefix: '/v1/tasks', group: 'tasks' },
    { templatePrefix: '/v1/goals', group: 'tasks' },
    { templatePrefix: '/v1/calendar', group: 'calendar' },
    { templatePrefix: '/v1/pulls', group: 'github' },
    { templatePrefix: '/v1/installations', group: 'github' },
    { templatePrefix: '/v1/github', group: 'github' },
    { templatePrefix: '/v1/organizations', group: 'organizations' },
    { templatePrefix: '/v1/invitations', group: 'organizations' },
    { templatePrefix: '/v1/workspaces', group: 'organizations' },
    { templatePrefix: '/v1/profile', group: 'account' },
    { templatePrefix: '/v1/me', group: 'account' },
    { templatePrefix: '/v1/users', group: 'account' },
    { templatePrefix: '/v1/tokens', group: 'account' },
    { templatePrefix: '/v1/feature-flags', group: 'feature_flags' },
    { templatePrefix: '/v1/admin', group: 'admin' },
    { templatePrefix: '/v1/roles', group: 'admin' },
    { templatePrefix: '/v1/access-grants', group: 'admin' },
    { templatePrefix: '/v1/authz', group: 'admin' },
  ],
};
