import { updateRolePermissionsSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateRolePermissionsRequest extends createZodDto(updateRolePermissionsSchema) {}
