import { listSessionEventsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindSessionEventsRequest extends createZodDto(listSessionEventsQuerySchema) {}
