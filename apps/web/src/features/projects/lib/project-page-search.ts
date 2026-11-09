import { z } from 'zod';

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

/**
 * A project page's address: `?view=stats` for its statistics (the overview
 * is no key), and the range they cover as `?from=&to=` days, which default to
 * the last eight weeks. Each is a link someone can send.
 */
export const projectPageSearchSchema = z.object({
  view: z.enum(['stats']).optional().catch(undefined),
  from: isoDay,
  to: isoDay,
});
export type ProjectPageSearch = z.infer<typeof projectPageSearchSchema>;
