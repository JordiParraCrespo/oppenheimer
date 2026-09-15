/**
 * Organization-plugin options the server (`organization()`) and the clients
 * (`organizationClient()`) must agree on. The `teams` flag decides whether the
 * workspace endpoints exist — "workspaces" are modelled on Better Auth teams —
 * so a client with a different value would generate types for endpoints the
 * server doesn't serve.
 *
 * Server-only options (invitation emails, membership limits, team-removal
 * policy) stay in `apps/api/src/auth/auth.ts`.
 */
export const organizationSharedOptions = {
  teams: { enabled: true },
} as const;
