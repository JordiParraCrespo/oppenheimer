import { listSessionTranscriptQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindSessionTranscriptRequest extends createZodDto(listSessionTranscriptQuerySchema) {}
