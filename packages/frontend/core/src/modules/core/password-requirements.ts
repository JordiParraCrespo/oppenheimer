import { PASSWORD_MIN_LENGTH } from '@oppenheimer/shared/constants';

export type PasswordRule = 'length' | 'match';

/**
 * The password rules, which are the ones the API actually enforces.
 *
 * `length` reads the shared minimum rather than repeating it, so the checklist
 * cannot promise one number while the schema and Better Auth enforce another.
 *
 * There is deliberately no mixed-case or digit rule. The checklist carried both
 * for a while and nothing on the server asked for either: Better Auth owns
 * sign-up and checks length alone, so a form demanding more refused passwords
 * the API would have taken. Adding them here again means adding them to
 * `PASSWORD_MIN_LENGTH`'s side of the wire first.
 *
 * `match` is the exception that earns its place: it compares two fields in one
 * form, which is not a thing an endpoint receiving one password can check.
 */
export function checkPassword(
  password: string,
  confirmation?: string,
): Record<PasswordRule, boolean> {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
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
