import { resetPasswordSchema } from '@oppenheimer/shared';
import { z } from 'zod';

export const newPasswordSchema = resetPasswordSchema
  .pick({ password: true })
  .extend({ confirmPassword: z.string().min(8) });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
