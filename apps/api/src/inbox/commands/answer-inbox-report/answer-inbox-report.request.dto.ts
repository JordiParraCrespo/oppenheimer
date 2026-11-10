import { answerInboxReportSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AnswerInboxReportRequest extends createZodDto(answerInboxReportSchema) {}
