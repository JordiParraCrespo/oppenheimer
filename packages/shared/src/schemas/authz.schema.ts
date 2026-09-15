import { z } from 'zod';

/** Who an access grant is addressed to. */
export const accessGrantPrincipalTypes = ['user', 'team', 'role'] as const;

/**
 * Create an access grant.
 *
 * `resourceId` omitted (or null) means every resource of that type within the
 * organization — the strongest grant expressible, and the one `canGrantScope`
 * restricts to callers who already hold it.
 *
 * Schemas here state the constraint only, never a message: an explicit string
 * would pin every consumer to English (see `.agents/rules/forms.md`).
 */
export const createAccessGrantSchema = z.object({
  principalType: z.enum(accessGrantPrincipalTypes),
  principalId: z.string().uuid(),
  resourceType: z.string().min(1).max(100),
  resourceId: z.string().uuid().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type CreateAccessGrantDto = z.infer<typeof createAccessGrantSchema>;
