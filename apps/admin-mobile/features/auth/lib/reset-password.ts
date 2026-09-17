import { resetPasswordSchema } from '@oppenheimer/shared';
import type { z } from 'zod';

/** The token arrives in the deep link, so only the password is user input. */
export const newPasswordSchema = resetPasswordSchema.pick({ password: true });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
