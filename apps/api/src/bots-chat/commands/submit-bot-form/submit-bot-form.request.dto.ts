import { submitBotFormSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SubmitBotFormRequest extends createZodDto(submitBotFormSchema) {}
