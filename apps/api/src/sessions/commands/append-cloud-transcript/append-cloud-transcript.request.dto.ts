import { appendCloudTranscriptSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AppendCloudTranscriptRequest extends createZodDto(appendCloudTranscriptSchema) {}
