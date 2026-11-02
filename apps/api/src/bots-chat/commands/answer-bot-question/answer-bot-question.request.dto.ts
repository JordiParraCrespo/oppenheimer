import { answerBotQuestionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AnswerBotQuestionRequest extends createZodDto(answerBotQuestionSchema) {}
