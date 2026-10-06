import { PULL_REQUEST_ANALYTICS_RANGES } from '@oppenheimer/shared/schemas/pull-request';
import { z } from 'zod';

export const analyticsSearchSchema = z.object({
  range: z.enum(PULL_REQUEST_ANALYTICS_RANGES).optional().catch(undefined),
});
