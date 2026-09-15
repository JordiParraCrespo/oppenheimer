import { paginationSchema } from '@oppenheimer/backend-core';
import { SUBSCRIPTION_STATUSES } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const findSubscriptionsSchema = paginationSchema.extend({
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
});

export class FindSubscriptionsRequest extends createZodDto(findSubscriptionsSchema) {}
