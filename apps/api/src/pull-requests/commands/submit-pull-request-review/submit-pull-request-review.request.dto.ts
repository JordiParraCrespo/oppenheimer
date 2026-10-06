import { submitPullRequestReviewSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SubmitPullRequestReviewRequest extends createZodDto(submitPullRequestReviewSchema) {}
