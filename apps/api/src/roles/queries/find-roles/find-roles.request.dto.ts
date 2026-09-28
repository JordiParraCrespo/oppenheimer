import { paginationSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const findRolesSchema = paginationSchema.extend({
  // Bounded: the term is matched against every role's name and description.
  search: z.string().trim().max(100).optional(),
});

export class FindRolesRequest extends createZodDto(findRolesSchema) {}
