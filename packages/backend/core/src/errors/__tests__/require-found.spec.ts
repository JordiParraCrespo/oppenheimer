import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AppError } from '../app.error';
import { type Maybe, requireFound } from '../require-found';

const NOT_FOUND = {
  code: 'THING_001',
  message: 'Thing not found',
  httpStatus: HttpStatus.NOT_FOUND,
};

// The two halves of an `oxide.ts` Option, by shape.
const some = <T>(value: T): Maybe<T> => ({ isNone: () => false, unwrap: () => value });
const none = <T>(): Maybe<T> => ({
  isNone: () => true,
  unwrap: () => {
    throw new Error('unwrap on None');
  },
});

describe('requireFound', () => {
  it('returns the value a lookup found', () => {
    expect(requireFound(some({ id: 't1' }), NOT_FOUND)).toEqual({ id: 't1' });
  });

  it('throws the catalog error, with the given detail, when it found nothing', () => {
    let thrown: unknown;
    try {
      requireFound(none(), NOT_FOUND, { detail: 'No thing with id t1' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppError);
    expect(thrown).toMatchObject({
      code: 'THING_001',
      title: 'Thing not found',
      detail: 'No thing with id t1',
    });
    expect((thrown as AppError).getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('throws with no detail when none is given', () => {
    expect(() => requireFound(none(), NOT_FOUND)).toThrow(
      expect.objectContaining({ code: 'THING_001', detail: undefined }),
    );
  });
});
