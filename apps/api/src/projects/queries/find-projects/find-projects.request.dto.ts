import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const findProjectsSchema = z.object({
  /**
   * Archived projects are tombstones — the row stays so its directory name is
   * never reused — so a listing hides them unless they are asked for. An
   * explicit `true`/`false` rather than a coerced boolean, because every
   * non-empty string coerces to `true` and `?includeArchived=false` would then
   * mean its opposite.
   */
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export class FindProjectsRequest extends createZodDto(findProjectsSchema) {}
