import { assignUserRolesSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AssignUserRolesRequest extends createZodDto(assignUserRolesSchema) {}
