import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryState, type QueryStateSource } from './query-state';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { exists: () => false, t: (key: string) => key },
  }),
}));

afterEach(cleanup);

function show(query: QueryStateSource<string[]>, renderError?: (error: unknown) => string) {
  return render(
    <QueryState
      query={query}
      pending="loading"
      errorFallback="Could not load the hosts"
      renderError={renderError}
      isEmpty={(rows) => rows.length === 0}
      empty="nothing here"
    >
      {(rows) => rows.join(', ')}
    </QueryState>,
  );
}

describe('QueryState', () => {
  it('holds the place until the first answer', () => {
    const { container } = show({ isPending: true, error: null, data: undefined });
    expect(container.textContent).toBe('loading');
  });

  it('says a read failed rather than loading or empty', () => {
    const { container } = show({ isPending: false, error: new Error('boom'), data: undefined });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(container.textContent).not.toContain('loading');
    expect(container.textContent).not.toContain('nothing here');
  });

  it('keeps showing the failure when stale data is still held', () => {
    const { container } = show({ isPending: false, error: new Error('boom'), data: ['a'] });
    expect(container.textContent).not.toContain('a, ');
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('lets the caller say a failure its own way', () => {
    const { container } = show(
      { isPending: false, error: new Error('boom'), data: undefined },
      () => 'route error',
    );
    expect(container.textContent).toBe('route error');
  });

  it('shows the empty state for an empty answer', () => {
    const { container } = show({ isPending: false, error: null, data: [] });
    expect(container.textContent).toBe('nothing here');
  });

  it('hands the data to its children', () => {
    const { container } = show({ isPending: false, error: null, data: ['optimus', 'build-03'] });
    expect(container.textContent).toBe('optimus, build-03');
  });
});
