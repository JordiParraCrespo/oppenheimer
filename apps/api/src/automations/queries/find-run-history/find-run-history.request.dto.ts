import { runHistoryQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindRunHistoryRequest extends createZodDto(runHistoryQuerySchema) {}
