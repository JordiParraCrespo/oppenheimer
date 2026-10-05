import { calendarRangeQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindCalendarEventsRequest extends createZodDto(calendarRangeQuerySchema) {}
