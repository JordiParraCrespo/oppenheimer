import {
  ArgumentInvalidException,
  type DomainPrimitive,
  ValueObject,
} from '@oppenheimer/backend-ddd';
import { USERNAME_MAX_LENGTH, USERNAME_PATTERN } from '@oppenheimer/shared';

/**
 * Normalised on the way in — trimmed and lowercased — and held to
 * `USERNAME_PATTERN`, so whichever writer builds one (the profile, the admin
 * surface, a mapper) the aggregate cannot hold a handle the form would refuse.
 */
export class Username extends ValueObject<string> {
  static from(raw: string): Username {
    return new Username({ value: raw.trim().toLowerCase() });
  }

  get value(): string {
    return this.props.value;
  }

  protected validate({ value }: DomainPrimitive<string>): void {
    if (value.length > USERNAME_MAX_LENGTH || !USERNAME_PATTERN.test(value)) {
      throw new ArgumentInvalidException(`Invalid username: ${value}`);
    }
  }
}
