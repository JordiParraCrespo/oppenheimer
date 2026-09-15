import { changeOwnPasswordSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ChangePasswordRequest extends createZodDto(changeOwnPasswordSchema) {}
