import { createRoleSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateRoleRequest extends createZodDto(createRoleSchema) {}
