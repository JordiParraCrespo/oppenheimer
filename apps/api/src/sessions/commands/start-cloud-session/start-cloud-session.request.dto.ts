import { startCloudSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class StartCloudSessionRequest extends createZodDto(startCloudSessionSchema) {}
