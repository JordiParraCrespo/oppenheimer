import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  banUserBodySchema,
  revokeSessionSchema,
  setUserPasswordSchema,
  setUserRoleBodySchema,
} from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AdminCreateUserRequest extends createZodDto(adminCreateUserSchema) {}
export class AdminUpdateUserRequest extends createZodDto(adminUpdateUserSchema) {}
export class SetUserRoleRequest extends createZodDto(setUserRoleBodySchema) {}
export class BanUserRequest extends createZodDto(banUserBodySchema) {}
export class SetUserPasswordRequest extends createZodDto(setUserPasswordSchema) {}
export class RevokeSessionRequest extends createZodDto(revokeSessionSchema) {}
