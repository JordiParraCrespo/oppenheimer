import { dismissBotQuestionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class DismissBotQuestionRequest extends createZodDto(dismissBotQuestionSchema) {}
