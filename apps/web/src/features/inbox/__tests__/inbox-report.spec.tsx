import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportAnswerForm } from '../forms/report-answer-form';
import { inboxCopy, matchesQuery } from '../lib/inbox-copy';
import { listedItems } from '../lib/inbox-filter';

/**
 * A report in the Inbox (`29-inbox.md`, "Reports"): a problem an agent sent,
 * read as a row and answered on its card. What breaks this: a row that reads
 * anything but the sender's own words (its source, title and body), so the
 * search cannot find it; a report with no source left without a sender; an
 * answer sent empty or untrimmed, which the API refuses.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(cleanup);

const t = ((key: string) => key) as unknown as TFunction;

function report(patch: { source?: string; body?: string } = {}): InboxItem {
  return {
    kind: 'report',
    key: 'report:rep1',
    since: new Date(0),
    projectIds: [],
    low: false,
    report: {
      id: 'rep1',
      title: 'Checkout shows a blank page',
      body: 'Seen on the nightly run.\nSafari only.',
      source: 'qa-explorer',
      ...patch,
    },
  } as unknown as InboxItem;
}

describe('a report as a row', () => {
  it('reads as its sender, its title and its body, and is found by any of them', () => {
    const copy = inboxCopy(report(), t);
    expect(copy).toMatchObject({
      sender: 'qa-explorer',
      short: 'Checkout shows a blank page',
      title: 'Checkout shows a blank page',
      body: 'Seen on the nightly run.\nSafari only.',
    });
    expect(matchesQuery(copy, 'QA-explorer')).toBe(true);
    expect(matchesQuery(copy, 'blank page')).toBe(true);
    expect(matchesQuery(copy, 'safari')).toBe(true);
    expect(matchesQuery(copy, 'firefox')).toBe(false);
  });

  it('names a sender for a report that did not say who sent it', () => {
    expect(inboxCopy(report({ source: '' }), t).sender).toBe('inbox.report.sender');
  });

  it('is counted under its own type, not with sessions or bots', () => {
    const rows = [report(), { ...report(), key: 'approval:a1', kind: 'approval' } as InboxItem];
    const pick = (type: 'report' | 'bots') =>
      listedItems(
        { open: rows, done: [] },
        { later: [], done: [] },
        { type, project: null },
        true,
      ).open.map((row) => row.key);
    expect(pick('report')).toEqual(['report:rep1']);
    expect(pick('bots')).toEqual(['approval:a1']);
  });
});

describe('ReportAnswerForm', () => {
  function renderForm(pending = false) {
    const onSubmit = vi.fn();
    render(<ReportAnswerForm pending={pending} onSubmit={onSubmit} alert={null} leading={null} />);
    return {
      onSubmit,
      field: screen.getByLabelText('inbox.report.answerLabel') as HTMLTextAreaElement,
      send: () => screen.getByRole('button', { name: /inbox\.report\.send/ }),
    };
  }

  it('sends nothing for an empty answer, and says so on the field', async () => {
    const { onSubmit, field, send } = renderForm();
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.click(send());
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends the answer as written, trimmed', async () => {
    const { onSubmit, field, send } = renderForm();
    fireEvent.change(field, { target: { value: '  Ship the fix, then rerun.\n' } });
    fireEvent.click(send());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ text: 'Ship the fix, then rerun.' });
  });

  it('holds the field while the answer is on its way', () => {
    expect(renderForm(true).field.disabled).toBe(true);
  });
});
