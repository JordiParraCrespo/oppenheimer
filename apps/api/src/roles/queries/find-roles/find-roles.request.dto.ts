import { paginationSchema } from '@oppenheimer/backend-core';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const findRolesSchema = paginationSchema.extend({
  search: z.string().optional(),
});

export class FindRolesRequest extends createZodDto(findRolesSchema) {}
