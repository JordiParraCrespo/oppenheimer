import { z } from 'zod';

/**
 * Auth DTOs. These carry no failure messages on purpose: an explicit message
 * wins over any error map Zod is handed, which would pin every consumer to
 * English. The apps translate from the issue code instead — see
 * `createZodErrorMap` in `@oppenheimer/frontend/validation`.
 */

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

/**
 * Accepting an invitation: the invitee's address is fixed by the invitation
 * itself, so the form only collects a display name and a password.
 */
export const acceptInvitationSchema = z.object({
  fullName: z.string().min(1),
  password: z.string().min(8),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
