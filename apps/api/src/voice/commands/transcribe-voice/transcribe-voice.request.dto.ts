import { transcribeVoiceSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class TranscribeVoiceRequest extends createZodDto(transcribeVoiceSchema) {}
