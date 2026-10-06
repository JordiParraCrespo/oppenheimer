import { connectGoogleCalendarSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ConnectGoogleCalendarRequest extends createZodDto(connectGoogleCalendarSchema) {}
