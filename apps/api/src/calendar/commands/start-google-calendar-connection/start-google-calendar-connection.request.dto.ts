import { startGoogleCalendarConnectionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class StartGoogleCalendarConnectionRequest extends createZodDto(
  startGoogleCalendarConnectionSchema,
) {}
