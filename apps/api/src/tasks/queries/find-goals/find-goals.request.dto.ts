import { listGoalsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindGoalsRequest extends createZodDto(listGoalsQuerySchema) {}
