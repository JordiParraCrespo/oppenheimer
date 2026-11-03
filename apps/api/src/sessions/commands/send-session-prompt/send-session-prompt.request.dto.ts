import { sendSessionPromptSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SendSessionPromptRequest extends createZodDto(sendSessionPromptSchema) {}
