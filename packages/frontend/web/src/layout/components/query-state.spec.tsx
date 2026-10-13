import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { combineQueries, QueryState, type QueryStateSource, rungOf } from './query-state';

// Partial: the forms concern's index also loads the i18n instance, which
// needs the real `initReactI18next`.
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { exists: () => false, t: (key: string) => key },
  }),
}));

afterEach(cleanup);

const boom = new Error('boom');

function show(
  query: QueryStateSource<string[]>,
  options: { renderError?: (error: unknown) => string; stale?: 'replace' | 'keep' } = {},
) {
  return render(
    <QueryState query={query} stale={options.stale} isEmpty={(rows) => rows.length === 0}>
      <QueryState.Pending>loading</QueryState.Pending>
      {options.renderError ? (
        <QueryState.Error>{options.renderError}</QueryState.Error>
      ) : (
        <QueryState.Error fallback="Could not load the hosts" />
      )}
      <QueryState.Empty>nothing here</QueryState.Empty>
      <QueryState.Data>{(rows: string[]) => rows.join(', ')}</QueryState.Data>
    </QueryState>,
  );
}

describe('QueryState', () => {
  it('holds the place until the first answer', () => {
    const { container } = show({ isPending: true, error: null, data: undefined });
    expect(container.textContent).toBe('loading');
  });

  it('says a first read failed rather than loading or empty', () => {
    const { container } = show({ isPending: false, error: boom, data: undefined });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(container.textContent).not.toContain('loading');
    expect(container.textContent).not.toContain('nothing here');
  });

  it('replaces data it holds with a later failure by default', () => {
    const { container } = show({ isPending: false, error: boom, data: ['optimus'] });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(container.textContent).not.toContain('optimus');
  });

  it('keeps drawing the data beside a later failure when asked', () => {
    const { container } = show(
      { isPending: false, error: boom, data: ['optimus'] },
      { stale: 'keep' },
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(container.textContent).toContain('optimus');
  });

  it('lets the caller say a failure its own way', () => {
    const { container } = show(
      { isPending: false, error: boom, data: undefined },
      { renderError: () => 'route error' },
    );
    expect(container.textContent).toBe('route error');
  });

  it('shows the empty state for an empty answer', () => {
    const { container } = show({ isPending: false, error: null, data: [] });
    expect(container.textContent).toBe('nothing here');
  });

  it('draws a later failure where its slot sits, above the data it keeps', () => {
    const { container } = show(
      { isPending: false, error: boom, data: ['optimus'] },
      { stale: 'keep', renderError: () => 'stale' },
    );
    expect(container.textContent).toBe('staleoptimus');
  });

  it('refuses a slot drawn outside its root', () => {
    // React logs the throw it rethrows; the assertion is the throw.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<QueryState.Pending>loading</QueryState.Pending>)).toThrow(/outside/);
    quiet.mockRestore();
  });

  it('hands the data to its children', () => {
    const { container } = show({ isPending: false, error: null, data: ['optimus', 'build-03'] });
    expect(container.textContent).toBe('optimus, build-03');
  });
});

describe('rungOf', () => {
  const empty = (rows: string[]) => rows.length === 0;
  const cases: [string, QueryStateSource<string[]>, 'replace' | 'keep', string, boolean][] = [
    [
      'no answer yet',
      { isPending: true, error: null, data: undefined },
      'replace',
      'pending',
      false,
    ],
    ['a first failure', { isPending: false, error: boom, data: undefined }, 'keep', 'failed', true],
    [
      'a later failure, replaced',
      { isPending: false, error: boom, data: ['a'] },
      'replace',
      'failed',
      true,
    ],
    ['a later failure, kept', { isPending: false, error: boom, data: ['a'] }, 'keep', 'data', true],
    [
      'a later failure on empty data, kept',
      { isPending: false, error: boom, data: [] },
      'keep',
      'empty',
      true,
    ],
    ['an empty answer', { isPending: false, error: null, data: [] }, 'replace', 'empty', false],
    ['an answer', { isPending: false, error: null, data: ['a'] }, 'replace', 'data', false],
  ];

  it.each(cases)('puts %s on its rung', (_, query, stale, rung, failed) => {
    const decided = rungOf(query, empty, stale);
    expect(decided.rung).toBe(rung);
    expect(decided.failure !== null).toBe(failed);
  });

  it('never calls an answer empty without isEmpty', () => {
    expect(rungOf({ isPending: false, error: null, data: [] }, undefined, 'replace').rung).toBe(
      'data',
    );
  });
});

describe('combineQueries', () => {
  const join = (a: string[], b: string[]) => [...a, ...b];

  it('waits for every read', () => {
    const both = combineQueries(
      { isPending: false, error: null, data: ['a'] },
      { isPending: true, error: null, data: undefined },
      join,
    );
    expect(both).toEqual({ isPending: true, error: null, data: undefined });
  });

  it('fails with the first failure', () => {
    const both = combineQueries(
      { isPending: false, error: null, data: ['a'] },
      { isPending: false, error: boom, data: undefined },
      join,
    );
    expect(both.error).toBe(boom);
  });

  it('combines once both hold data', () => {
    const both = combineQueries(
      { isPending: false, error: null, data: ['a'] },
      { isPending: false, error: null, data: ['b'] },
      join,
    );
    expect(both.data).toEqual(['a', 'b']);
  });
});
