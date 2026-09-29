import { setUserPasswordSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SetUserPasswordRequest extends createZodDto(setUserPasswordSchema) {}
