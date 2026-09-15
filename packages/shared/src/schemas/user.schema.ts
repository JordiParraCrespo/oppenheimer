import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  // Free-form role name; roles are managed dynamically via the roles module.
  role: z.string().min(1).default('user'),
});

// `role` is deliberately omitted: it maps to the Better Auth `user.role`
// column, which gates the admin plugin (impersonate/ban/set-password) and is
// unioned into the caller's CASL ability. Letting a profile update write it
// turns `update User` into privilege escalation. Role changes go through the
// dedicated, grant-checked paths instead — `PUT /v1/users/:userId/roles` for
// the dynamic-RBAC join and the admin plugin's `set-role` for `user.role`.
export const updateUserSchema = createUserSchema.partial().omit({ email: true, role: true });

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  /** Legacy primary role name (kept for backwards compatibility). */
  role: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
