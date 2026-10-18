import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotApprovalCard } from '../sections/bot-approval-card';

/**
 * The Needs input card. What breaks this: a card drawn when nothing waits
 * (or while it loads); Approve sending anything but this card's id and the
 * digest of the call it shows; Deny answering at once instead of asking what
 * to do instead, or losing the note; a card past its time still offering to
 * run.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const state = vi.hoisted(() => ({
  approval: null as null | {
    id: string;
    tool: string;
    summary: string;
    callDigest: string;
    isExpiredAt: (now: number) => boolean;
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

const DIGEST = 'd'.repeat(64);

function card(summary: string, expired = false) {
  return {
    id: 'a-1',
    tool: 'start_session',
    summary,
    callDigest: DIGEST,
    isExpiredAt: () => expired,
  };
}

describe('BotApprovalCard', () => {
  it('draws nothing when the bot waits on nothing', () => {
    const { container } = render(<BotApprovalCard botId="bot-1" name="Scout" />);
    expect(container.innerHTML).toBe('');
  });

  it('says what will happen, and Approve answers this card, naming the call it shows', () => {
    state.approval = card('Start Claude Code on build-02');
    render(<BotApprovalCard botId="bot-1" name="Scout" />);
    expect(screen.getByText('Start Claude Code on build-02')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.approval.approve' }));
    expect(state.mutate).toHaveBeenCalledWith(
      {
        id: 'bot-1',
        approvalId: 'a-1',
        decision: 'approve',
        note: undefined,
        callDigest: DIGEST,
      },
      expect.anything(),
    );
  });

  it('says a card past its time expired, and offers neither Approve nor Deny', () => {
    state.approval = card('Delete bot "Grace" for good', true);
    render(<BotApprovalCard botId="bot-1" name="Scout" />);
    expect(screen.getByText('bots.chat.approval.expired')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it('asks what to do instead before denying, and sends the note with the no', async () => {
    state.approval = card('Start it');
    render(<BotApprovalCard botId="bot-1" name="Scout" />);
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.approval.deny' }));
    expect(state.mutate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Use staging' } });
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.approval.deny' }));
    await waitFor(() =>
      expect(state.mutate).toHaveBeenCalledWith(
        { id: 'bot-1', approvalId: 'a-1', decision: 'deny', note: 'Use staging' },
        expect.anything(),
      ),
    );
  });
});
