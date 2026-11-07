import { updatePersonAboutSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdatePersonAboutRequest extends createZodDto(updatePersonAboutSchema) {}
