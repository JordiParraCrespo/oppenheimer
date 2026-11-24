import { resetPasswordSchema } from '@oppenheimer/shared';
import { z } from 'zod';

/**
 * The token rides in the deep link, so only the two password fields are user
 * input. Whether they match is checked here, not in the shared schema, which
 * carries no messages; a `refine` states its own, so it is passed in
 * translated. The web console's reset form does the same.
 */
export function newPasswordSchema(mismatch: string) {
  return resetPasswordSchema
    .pick({ password: true })
    .extend({ confirmPassword: z.string().min(8) })
    .refine((values) => values.password === values.confirmPassword, {
      path: ['confirmPassword'],
      message: mismatch,
    });
}

export type NewPasswordValues = z.infer<ReturnType<typeof newPasswordSchema>>;
