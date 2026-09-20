import { listSessionsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindSessionsRequest extends createZodDto(listSessionsQuerySchema) {}
