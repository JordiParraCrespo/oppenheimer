import { updateMemberRoleSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateMemberRoleRequest extends createZodDto(updateMemberRoleSchema) {}
