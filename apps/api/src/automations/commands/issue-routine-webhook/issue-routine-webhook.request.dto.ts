import { issueRoutineWebhookSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class IssueRoutineWebhookRequest extends createZodDto(issueRoutineWebhookSchema) {}
