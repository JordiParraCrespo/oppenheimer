import { pullRequestAnalyticsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindPullRequestAnalyticsRequest extends createZodDto(
  pullRequestAnalyticsQuerySchema,
) {}
