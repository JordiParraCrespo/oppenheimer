import { updateGoalSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateGoalRequest extends createZodDto(updateGoalSchema) {}
