import { createCalendarEventSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCalendarEventRequest extends createZodDto(createCalendarEventSchema) {}
