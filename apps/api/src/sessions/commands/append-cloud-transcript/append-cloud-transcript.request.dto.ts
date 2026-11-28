import { KeepsMarkup } from '@oppenheimer/backend-core';
import { appendCloudTranscriptSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

/** Transcript lines and replies carry code: kept as sent. */
@KeepsMarkup()
export class AppendCloudTranscriptRequest extends createZodDto(appendCloudTranscriptSchema) {}
