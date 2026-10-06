import { pullRequestsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindPullRequestsRequest extends createZodDto(pullRequestsQuerySchema) {}
