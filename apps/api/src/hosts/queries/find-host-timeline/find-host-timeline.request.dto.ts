import { hostTimelineQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindHostTimelineRequest extends createZodDto(hostTimelineQuerySchema) {}
