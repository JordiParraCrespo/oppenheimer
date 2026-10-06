import { createGoalSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateGoalRequest extends createZodDto(createGoalSchema) {}
