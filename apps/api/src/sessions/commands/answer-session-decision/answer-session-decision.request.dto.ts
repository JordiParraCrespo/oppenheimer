import { answerSessionDecisionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AnswerSessionDecisionRequest extends createZodDto(answerSessionDecisionSchema) {}
