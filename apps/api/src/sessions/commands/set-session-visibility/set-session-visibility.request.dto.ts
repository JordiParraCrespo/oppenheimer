import { setSessionVisibilitySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SetSessionVisibilityRequest extends createZodDto(setSessionVisibilitySchema) {}
