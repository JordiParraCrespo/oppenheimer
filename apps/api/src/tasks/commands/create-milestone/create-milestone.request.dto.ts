import { createMilestoneSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateMilestoneRequest extends createZodDto(createMilestoneSchema) {}
