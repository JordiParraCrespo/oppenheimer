import { updateBotRoutineSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateBotRoutineRequest extends createZodDto(updateBotRoutineSchema) {}
