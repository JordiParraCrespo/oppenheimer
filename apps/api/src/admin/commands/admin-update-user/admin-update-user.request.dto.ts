import { adminUpdateUserSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AdminUpdateUserRequest extends createZodDto(adminUpdateUserSchema) {}
