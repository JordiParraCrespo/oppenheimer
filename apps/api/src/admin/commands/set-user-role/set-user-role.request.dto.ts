import { setUserRoleBodySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SetUserRoleRequest extends createZodDto(setUserRoleBodySchema) {}
