import { updateMilestoneSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateMilestoneRequest extends createZodDto(updateMilestoneSchema) {}
