import { googleCalendarEventsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindGoogleCalendarEventsRequest extends createZodDto(
  googleCalendarEventsQuerySchema,
) {}
