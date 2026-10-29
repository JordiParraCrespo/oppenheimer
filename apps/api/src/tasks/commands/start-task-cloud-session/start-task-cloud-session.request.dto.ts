import { startTaskCloudSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class StartTaskCloudSessionRequest extends createZodDto(startTaskCloudSessionSchema) {}
