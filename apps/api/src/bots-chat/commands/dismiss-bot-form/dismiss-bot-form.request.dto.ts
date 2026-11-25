import { dismissBotFormSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class DismissBotFormRequest extends createZodDto(dismissBotFormSchema) {}
