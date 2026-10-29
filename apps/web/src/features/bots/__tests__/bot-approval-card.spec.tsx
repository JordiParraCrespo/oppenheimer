import type { BotApprovalDetails } from '@oppenheimer/frontend-consumer';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotApprovalCard } from '../sections/bot-approval-card';

const details = (extra: Partial<BotApprovalDetails> = {}): BotApprovalDetails => ({
  input: { task: 'Fix it' },
  subjectLabel: null,
  sharesOutside: false,
  reviewNote: null,
  reaches: ['once'],
  reach: null,
  ...extra,
});

/**
 * The Needs input card. What breaks this: a card drawn when nothing waits
 * (or while it loads); Approve sending anything but this card's id; Deny
 * answering at once instead of asking what to do instead, or losing the note.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const state = vi.hoisted(() => ({
  approval: null as null | {
    id: string;
    tool: string;
    summary: string;
    details: BotApprovalDetails;
  },
  mutate: vi.fn(),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotPendingApproval: () => ({ data: state.approval, refetch: vi.fn() }),
  useDecideBotApproval: () => ({
    mutate: state.mutate,
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useVoiceDictation: () => ({ available: false, transcribe: vi.fn() }),
}));

vi.mock('@oppenheimer/frontend-web', () => ({
  ErrorAlert: () => null,
  useZodResolver: () => undefined,
  DictationField: ({ children }: { children: ReactNode }) => children,
  dictateIntoField: () => () => {},
}));

afterEach(() => {
  cleanup();
  state.approval = null;
  state.mutate.mockReset();
});

describe('BotApprovalCard', () => {
  it('draws nothing when the bot waits on nothing', () => {
    const { container } = render(<BotApprovalCard botId="bot-1" name="Scout" />);
    expect(container.innerHTML).toBe('');
  });

  it('says what will happen, and Approve answers this card', () => {
    state.approval = {
      id: 'a-1',
      tool: 'start_session',
      summary: 'Start Claude Code on build-02',
      details: details(),
    };
    render(<BotApprovalCard botId="bot-1" name="Scout" />);
    expect(screen.getByText('Start Claude Code on build-02')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.approval.approve' }));
    expect(state.mutate).toHaveBeenCalledWith(
      { id: 'bot-1', approvalId: 'a-1', decision: 'approve', note: undefined, reach: 'once' },
      expect.anything(),
    );
  });

  it('asks what to do instead before denying, and sends the note with the no', async () => {
    state.approval = { id: 'a-1', tool: 'start_session', summary: 'Start it', details: details() };
    render(<BotApprovalCard botId="bot-1" name="Scout" />);
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.approval.deny' }));
    expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Use staging' } });
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.approval.deny' }));
    await waitFor(() =>
      expect(state.mutate).toHaveBeenCalledWith(
        { id: 'bot-1', approvalId: 'a-1', decision: 'deny', note: 'Use staging', reach: undefined },
        expect.anything(),
      ),
    );
  });

  it('offers to always allow the tool on what the call acts on, and says why a rule paused it', () => {
    state.approval = {
      id: 'a-1',
      tool: 'comment_on_pull_request',
      summary: 'Comment on acme/docs#4',
      details: details({
        subjectLabel: 'acme/docs',
        sharesOutside: true,
        reviewNote: 'Paused by your rule “Ask before payments”',
        reaches: ['once', 'subject', 'tool'],
      }),
    };
    render(<BotApprovalCard botId="bot-1" name="Scout" />);
    expect(screen.getByText('Paused by your rule “Ask before payments”')).toBeTruthy();
    expect(screen.getByText('bots.chat.approval.sharesOutside')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.approval.alwaysFor' }));
    expect(state.mutate).toHaveBeenCalledWith(
      { id: 'bot-1', approvalId: 'a-1', decision: 'approve', note: undefined, reach: 'subject' },
      expect.anything(),
    );
    expect(screen.getByRole('button', { name: 'bots.chat.approval.approveOnce' })).toBeTruthy();
  });

  it('offers only this call for a merge', () => {
    state.approval = {
      id: 'a-1',
      tool: 'merge_pull_request',
      summary: 'Merge acme/docs#4',
      details: details({ subjectLabel: 'acme/docs', reaches: ['once'] }),
    };
    render(<BotApprovalCard botId="bot-1" name="Scout" />);
    expect(screen.queryByRole('button', { name: 'bots.chat.approval.alwaysFor' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'bots.chat.approval.always' })).toBeNull();
    expect(screen.getByRole('button', { name: 'bots.chat.approval.approve' })).toBeTruthy();
  });
});
