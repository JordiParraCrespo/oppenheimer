import { PASSWORD_MIN_LENGTH } from '@oppenheimer/shared/constants';

export type PasswordRule = 'length' | 'case' | 'number' | 'match';

/**
 * The password rules enforced consistently by every frontend platform.
 *
 * `length` reads the shared minimum rather than repeating it, so the checklist
 * cannot promise one number while the schema and Better Auth enforce another.
 * The `case` and `number` rules are the checklist's alone — the schema does not
 * ask for them — so a form that shows them is stricter than the API it posts to.
 */
export function checkPassword(
  password: string,
  confirmation?: string,
): Record<PasswordRule, boolean> {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    case: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    match: password.length > 0 && password === confirmation,
  };
}

/** True once every rule requested by a form is satisfied. */
export function meetsPasswordRequirements(
  results: Record<PasswordRule, boolean>,
  rules: readonly PasswordRule[],
) {
  return rules.every((rule) => results[rule]);
}
