import { issueSessionPreviewSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class IssueSessionPreviewRequest extends createZodDto(issueSessionPreviewSchema) {}
