import { listMilestonesQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindMilestonesRequest extends createZodDto(listMilestonesQuerySchema) {}
