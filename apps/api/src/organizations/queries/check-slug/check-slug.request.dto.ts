import { checkSlugSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CheckSlugRequest extends createZodDto(checkSlugSchema) {}
