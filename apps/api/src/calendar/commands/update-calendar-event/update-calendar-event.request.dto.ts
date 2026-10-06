import { updateCalendarEventSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateCalendarEventRequest extends createZodDto(updateCalendarEventSchema) {}
