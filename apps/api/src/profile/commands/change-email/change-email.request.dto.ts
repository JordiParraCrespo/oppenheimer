import { changeEmailSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ChangeEmailRequest extends createZodDto(changeEmailSchema) {}
