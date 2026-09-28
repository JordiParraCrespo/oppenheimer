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

interface Values {
  username: string;
  nickname?: string;
  address: { city: string };
}

function setup(initial: ServerFieldErrorSource) {
  return renderHook(
    ({ source }) => {
      const form = useForm<Values>({
        defaultValues: { username: '', nickname: undefined, address: { city: '' } },
      });
      const result = useServerFieldErrors(form, source);
      return { form, result };
    },
    { initialProps: { source: initial } },
  );
}

describe('useServerFieldErrors', () => {
  it('marks a refused field with the translated line, never the server reason', () => {
    const { result } = setup(refused([{ name: 'username', reason: 'must match /^[a-z]+$/' }]));

    expect(result.current.form.getFieldState('username').error?.message).toBe('validation.invalid');
    expect(result.current.result).toEqual({ unplaced: [], showAlert: false });
  });

  it('finds a field whose value is undefined, and a nested one', () => {
    const { result } = setup({ fieldErrors: { nickname: 'taken', 'address.city': 'unknown' } });

    expect(result.current.form.getFieldState('nickname').invalid).toBe(true);
    expect(result.current.form.getFieldState('address.city').invalid).toBe(true);
    expect(result.current.result.showAlert).toBe(false);
  });

  it('keeps the alert for a name the form does not have', () => {
    const { result } = setup(refused([{ name: 'organizationId', reason: 'unknown' }]));

    expect(result.current.result).toEqual({ unplaced: ['organizationId'], showAlert: true });
  });

  it('keeps the alert for a failure that names no field, and hides it with no failure', () => {
    expect(setup({ fieldErrors: {} }).result.current.result.showAlert).toBe(true);
    expect(setup(null).result.current.result.showAlert).toBe(false);
  });

  it('does not re-mark a field the reader cleared while the same failure shows', () => {
    const { result, rerender } = setup({ fieldErrors: { username: 'taken' } });
    result.current.form.clearErrors('username');

    rerender({ source: { fieldErrors: { username: 'taken' } } });

    expect(result.current.form.getFieldState('username').invalid).toBe(false);
  });
});
