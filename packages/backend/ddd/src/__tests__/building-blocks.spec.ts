import { describe, expect, it } from 'vitest';
import { AggregateRoot } from '../aggregate-root.base';
import { CommandBase } from '../command.base';
import { ArgumentNotProvidedException, NotFoundException } from '../exceptions';
import { Guard } from '../guard';
import { RequestContextService } from '../request-context.service';
import { ValueObject } from '../value-object.base';

class Email extends ValueObject<string> {
  protected validate(): void {}
}

class Address extends ValueObject<{ city: string; email: Email }> {
  protected validate(): void {}
}

class Person extends AggregateRoot<{
  name: string;
  address: Address;
  emails: Email[];
  bornAt: Date;
}> {
  validate(): void {}

  touch(at?: Date): void {
    this.setUpdatedAt(at);
  }
}

const person = (id = 'person-1') =>
  new Person({
    id,
    props: {
      name: 'Ada',
      address: new Address({ city: 'London', email: new Email({ value: 'ada@example.com' }) }),
      emails: [new Email({ value: 'a@example.com' })],
      bornAt: new Date('1815-12-10T00:00:00Z'),
    },
  });

describe('Entity.toObject', () => {
  it('unpacks value objects nested inside value objects and arrays, and keeps dates as dates', () => {
    const plain = person().toObject() as Record<string, unknown>;

    expect(plain.address).toEqual({ city: 'London', email: 'ada@example.com' });
    expect(plain.emails).toEqual(['a@example.com']);
    expect(plain.bornAt).toBeInstanceOf(Date);
    expect((plain.bornAt as Date).toISOString()).toBe('1815-12-10T00:00:00.000Z');
  });
});

describe('Entity', () => {
  it('refuses an entity with no identity', () => {
    expect(() => person('')).toThrow(ArgumentNotProvidedException);
    expect(() => person('   ')).toThrow(ArgumentNotProvidedException);
  });

  it('stamps updatedAt with now unless given the time', () => {
    const p = person();
    const at = new Date('2030-01-01T00:00:00Z');
    p.touch(at);
    expect(p.updatedAt).toBe(at);
    const before = Date.now();
    p.touch();
    expect(p.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('CommandBase', () => {
  class RefreshCommand extends CommandBase {}

  it('accepts a command with no payload', () => {
    const command = new RefreshCommand({});
    expect(command.id).toEqual(expect.any(String));
    expect(command.metadata.correlationId).toEqual(expect.any(String));
  });

  it('takes the correlation id from the request context', () => {
    const command = RequestContextService.run(
      { correlationId: 'corr-1' },
      () => new RefreshCommand({}),
    );
    expect(command.metadata.correlationId).toBe('corr-1');
  });
});

describe('Guard', () => {
  it('treats a whitespace-only string as empty', () => {
    expect(Guard.isEmpty('   ')).toBe(true);
    expect(Guard.isEmpty(' a ')).toBe(false);
    expect(Guard.isEmpty(0)).toBe(false);
  });

  it('answers false for the length of an empty value instead of throwing', () => {
    expect(Guard.lengthIsBetween('', 1, 3)).toBe(false);
    expect(Guard.lengthIsBetween('abc', 1, 3)).toBe(true);
    expect(Guard.lengthIsBetween([1, 2, 3, 4], 1, 3)).toBe(false);
  });
});

describe('ExceptionBase', () => {
  it('names itself after its class and serializes its status and a safe cause', () => {
    const cause = Object.assign(new Error('socket closed'), { secret: 'token' });
    const error = new ArgumentNotProvidedException('missing', cause);

    expect(error.name).toBe('ArgumentNotProvidedException');
    expect(error.toJSON()).toMatchObject({
      name: 'ArgumentNotProvidedException',
      code: 'GENERIC.ARGUMENT_NOT_PROVIDED',
      httpStatus: 400,
      cause: { name: 'Error', message: 'socket closed' },
    });
    expect(JSON.stringify(error.toJSON())).not.toContain('token');
  });

  it('keeps the default not-found message', () => {
    expect(new NotFoundException().message).toBe('Not found');
    expect(new NotFoundException().toJSON().cause).toBeUndefined();
  });
});

describe('RequestContextService.run', () => {
  it("returns the function's result, sync or async", async () => {
    expect(RequestContextService.run({ correlationId: 'c' }, () => 42)).toBe(42);
    await expect(
      RequestContextService.run({ correlationId: 'c' }, async () =>
        RequestContextService.getCorrelationId(),
      ),
    ).resolves.toBe('c');
  });
});
