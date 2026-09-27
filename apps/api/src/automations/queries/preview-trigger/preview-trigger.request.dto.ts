import { triggerPreviewSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PreviewTriggerRequest extends createZodDto(triggerPreviewSchema) {}
