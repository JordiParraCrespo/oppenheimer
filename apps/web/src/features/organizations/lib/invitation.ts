import { AuthRequestError } from '@oppenheimer/auth/client';

/** "Lucía Ferrer" → first "Lucía", last "Ferrer"; a single word becomes both. */
export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;

  return { firstName, lastName };
}

/** The initials shown on the inviter's avatar. */
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function isExistingAccountError(error: unknown): boolean {
  if (!(error instanceof AuthRequestError)) return false;
  return (
    error.code === 'USER_ALREADY_EXISTS' || error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
  );
}
