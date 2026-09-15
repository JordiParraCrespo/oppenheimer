import { paginationSchema } from '@oppenheimer/backend-core';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const findUsersSchema = paginationSchema.extend({
  // Roles are dynamic; filter by any role name.
  role: z.string().optional(),
  search: z.string().optional(),
});

export class FindUsersRequest extends createZodDto(findUsersSchema) {}
