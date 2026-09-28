import { AppError } from '@oppenheimer/frontend-core';
import { renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { type ServerFieldErrorSource, useServerFieldErrors } from './use-server-field-errors';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const refused = (invalidParams: { name: string; reason: string }[]) =>
  new AppError(
    { code: 'X_CLIENT_001', message: 'Failed' },
    {
      status: 400,
      problem: { type: 'about:blank', title: 'Bad Request', status: 400, invalidParams },
    },
  );

function setup(initial: ServerFieldErrorSource) {
  return renderHook(
    ({ source }) => {
      const form = useForm({ defaultValues: { username: '', firstName: '' } });
      const leftover = useServerFieldErrors(form, source);
      return { form, leftover };
    },
    { initialProps: { source: initial } },
  );
}

describe('useServerFieldErrors', () => {
  it('marks a refused field with the translated line, never the server reason', () => {
    const { result } = setup(refused([{ name: 'username', reason: 'must match /^[a-z]+$/' }]));

    expect(result.current.form.getFieldState('username').error?.message).toBe('validation.invalid');
    expect(result.current.leftover).toEqual([]);
  });

  it('reads a resolved message as well as the error', () => {
    const { result } = setup({ fieldErrors: { firstName: 'too long' } });

    expect(result.current.form.getFieldState('firstName').invalid).toBe(true);
  });

  it('hands back a field the form does not have', () => {
    const { result } = setup(refused([{ name: 'organizationId', reason: 'unknown' }]));

    expect(result.current.leftover).toEqual(['organizationId']);
  });

  it('does not re-mark a field the reader cleared while the same failure shows', () => {
    const failure = { fieldErrors: { username: 'taken' } };
    const { result, rerender } = setup(failure);
    result.current.form.clearErrors('username');

    rerender({ source: { fieldErrors: { username: 'taken' } } });

    expect(result.current.form.getFieldState('username').invalid).toBe(false);
  });
});
