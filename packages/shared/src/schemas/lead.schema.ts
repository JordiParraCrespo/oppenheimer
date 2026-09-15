import { z } from 'zod';

/**
 * Creating a lead. The organization is never taken from the body — it comes
 * from the caller's active organization, so a client cannot file a lead into
 * another tenant.
 *
 * Schemas state the constraint only, never a message: an explicit string would
 * pin every consumer to English (see `.agents/rules/forms.md`).
 */
export const createLeadSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  /** Deal value in minor units. */
  value: z.number().int().min(0).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export type CreateLeadDto = z.infer<typeof createLeadSchema>;
