import { planStatsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindPlanStatsRequest extends createZodDto(planStatsQuerySchema) {}
