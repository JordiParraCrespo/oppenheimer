export type PasswordRule = 'length' | 'case' | 'number' | 'match';

/** The password rules enforced consistently by every frontend platform. */
export function checkPassword(
  password: string,
  confirmation?: string,
): Record<PasswordRule, boolean> {
  return {
    length: password.length >= 8,
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
