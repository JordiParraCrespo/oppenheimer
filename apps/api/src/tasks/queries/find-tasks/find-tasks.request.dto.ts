import { listTasksQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindTasksRequest extends createZodDto(listTasksQuerySchema) {}
