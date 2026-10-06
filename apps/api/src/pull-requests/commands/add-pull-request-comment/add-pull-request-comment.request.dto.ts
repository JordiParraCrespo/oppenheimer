import { addPullRequestCommentSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AddPullRequestCommentRequest extends createZodDto(addPullRequestCommentSchema) {}
