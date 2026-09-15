import {
  ArgumentInvalidException,
  type DomainPrimitive,
  ValueObject,
} from '@oppenheimer/backend-ddd';

/**
 * Email address value object. Immutable and self-validating: an `Email`
 * instance is guaranteed to hold a structurally valid address.
 */
export class Email extends ValueObject<string> {
  // Pragmatic RFC 5322-ish check — good enough to reject obvious garbage.
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  get value(): string {
    return this.props.value;
  }

  protected validate({ value }: DomainPrimitive<string>): void {
    if (!Email.EMAIL_REGEX.test(value)) {
      throw new ArgumentInvalidException(`Invalid email address: ${value}`);
    }
  }
}
