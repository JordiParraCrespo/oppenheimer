import { paginationSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const findUsersSchema = paginationSchema.extend({
  // Roles are dynamic; filter by any role name.
  role: z.string().optional(),
  // Bounded: the term is matched against every row's name and email.
  search: z.string().trim().max(100).optional(),
});

export class FindUsersRequest extends createZodDto(findUsersSchema) {}
