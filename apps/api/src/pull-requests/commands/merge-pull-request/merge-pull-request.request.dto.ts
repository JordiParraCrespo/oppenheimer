import { mergePullRequestSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class MergePullRequestRequest extends createZodDto(mergePullRequestSchema) {}
