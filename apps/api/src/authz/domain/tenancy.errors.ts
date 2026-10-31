/**
 * The one refusal for a tenant operation asked without an organization. It
 * used to be a code per module (`BOTS_002`, `TASKS_003`, …), each saying the
 * same thing about a different noun; a client acts on it the same way
 * whichever module answered: open a workspace and try again.
 */
export const TenancyErrors = {
  NO_ACTIVE_ORGANIZATION: {
    code: 'TENANT_001',
    message: 'No active workspace',
    httpStatus: 400,
  },
} as const;
