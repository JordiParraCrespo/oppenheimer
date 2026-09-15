import { updateUserSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateUserRequest extends createZodDto(updateUserSchema) {}
