import { randomUUID } from 'node:crypto';
import { ArgumentInvalidException, ValueObject } from '@oppenheimer/backend-ddd';

/** Longest the readable half may grow before the uniqueness suffix is added. */
const MAX_READABLE_LENGTH = 32;

/** What survives slugification, plus the `-xxxxxxxx` suffix `derive` appends. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The URL-safe name an organization is addressed by. A value object so the
 * workspace sign-up provisions and one a person creates by hand cannot
 * disagree about what a slug is.
 */
export class OrganizationSlug extends ValueObject<string> {
  /**
   * The display name is reduced to URL characters and capped, then a random
   * suffix is appended: `slug` is unique in the database, and two people who
   * name their workspace the same thing must not collide on it. A name with
   * nothing slug-safe in it (an all-emoji name, a name in a non-Latin script)
   * still yields a usable slug rather than a bare suffix.
   */
  static derive(displayName: string): OrganizationSlug {
    const readable = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_READABLE_LENGTH)
      // The cap can land on a hyphen, which would leave `foo--1a2b3c4d`.
      .replace(/-+$/, '');
    return new OrganizationSlug({
      value: `${readable || 'workspace'}-${randomUUID().slice(0, 8)}`,
    });
  }

  get value(): string {
    return this.props.value;
  }

  protected validate({ value }: { value: string }): void {
    if (!SLUG_PATTERN.test(value)) {
      throw new ArgumentInvalidException(
        'An organization slug must be lowercase alphanumerics separated by single hyphens',
      );
    }
  }
}
