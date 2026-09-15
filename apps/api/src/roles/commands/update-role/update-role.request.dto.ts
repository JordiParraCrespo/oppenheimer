import { updateRoleSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateRoleRequest extends createZodDto(updateRoleSchema) {}
