import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FailingCheck } from '../components/failing-check';

/**
 * A failing check in the rail: linked to its log when it gave one, and, when
 * a bot looked into it, its verdicts, cause, next step and evidence; a check
 * nobody looked into says so rather than showing an empty record.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { next?: string }) => (values?.next ? `${key}|${values.next}` : key),
  }),
}));

afterEach(cleanup);

const check = { name: 'test', url: 'https://ci.example/runs/2', title: '2 tests failed' };

describe('FailingCheck', () => {
  it('links the check to its log and draws what a bot found', () => {
    render(
      <FailingCheck
        check={check}
        finding={{
          id: 'f-1',
          check: 'test',
          rootCause: 'parseDate does not guard an empty string.',
          relation: 'this_change',
          flake: 'real',
          action: 'fix_here',
          next: 'Return null for an empty string.',
          confidence: 'high',
          evidence: ['FAIL src/date.spec.ts'],
          recordedByBotId: 'bot-1',
          updatedAt: new Date('2026-10-29T10:00:00Z'),
        }}
      />,
    );
    expect(screen.getByRole('link', { name: 'test' }).getAttribute('href')).toBe(
      'https://ci.example/runs/2',
    );
    expect(screen.getByText('2 tests failed')).toBeTruthy();
    for (const verdict of [
      'pullRequests.detail.ci.relation.this_change',
      'pullRequests.detail.ci.flake.real',
      'pullRequests.detail.ci.action.fix_here',
      'pullRequests.detail.ci.confidence.high',
    ]) {
      expect(screen.getByText(verdict)).toBeTruthy();
    }
    expect(screen.getByText('parseDate does not guard an empty string.')).toBeTruthy();
    expect(
      screen.getByText('pullRequests.detail.ci.next|Return null for an empty string.'),
    ).toBeTruthy();
    expect(screen.getByText('FAIL src/date.spec.ts')).toBeTruthy();
  });

  it('says a check was not looked into, and names one with no log without a link', () => {
    render(<FailingCheck check={{ ...check, url: null }} finding={undefined} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('pullRequests.detail.ci.notLookedInto')).toBeTruthy();
  });
});
