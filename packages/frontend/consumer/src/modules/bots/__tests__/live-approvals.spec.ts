import type { BotApprovalEvent } from '@oppenheimer/shared/schemas/bot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BotApprovalEntity,
  BotConversationEntity,
  BotMessageEntity,
} from '../bot-conversation.entity';
import {
  APPROVAL_HOLD_MAX_MS,
  BotApprovalHold,
  botResolvedApprovals,
  NO_RESOLVED_APPROVALS,
  noteResolvedApproval,
  RESOLVED_APPROVALS_MAX,
  withoutClosedApproval,
} from '../live-approvals';

/**
 * A bot's Needs input cards as the stream tells of them: a card another tab
 * decided leaves this one at once and is drawn as its decided line until the
 * stored line lands, never twice; a card raised mid-sentence waits for the
 * line to end, or the cap, and never longer.
 */
const at = new Date('2026-10-31T10:00:00Z');

function resolved(approvalId: string, outcome: 'approved' | 'denied' | 'stopped' | 'expired') {
  return {
    type: 'approval_resolved' as const,
    approvalId,
    outcome,
    tool: 'start_session',
    summary: 'Start Claude Code',
  };
}

function storedLine(approvalId: string): BotMessageEntity {
  const event: BotApprovalEvent = {
    kind: 'approval',
    outcome: 'denied',
    tool: 'start_session',
    summary: 'Start Claude Code',
    sessionId: null,
    approvalId,
  };
  return new BotMessageEntity(`m-${approvalId}`, 't2', 'event', 'Ana denied', [], at, event);
}

describe('a card decided elsewhere', () => {
  it('is drawn as its decided line, once, and an expired card draws none', () => {
    let lines = noteResolvedApproval(NO_RESOLVED_APPROVALS, resolved('a1', 'stopped'));
    lines = noteResolvedApproval(lines, resolved('a1', 'stopped'));
    lines = noteResolvedApproval(lines, resolved('a2', 'expired'));
    expect(lines).toEqual([
      {
        kind: 'approval',
        outcome: 'stopped',
        tool: 'start_session',
        summary: 'Start Claude Code',
        sessionId: null,
        approvalId: 'a1',
      },
    ]);
  });

  it('keeps only the newest few waiting for their line', () => {
    let lines = NO_RESOLVED_APPROVALS;
    for (let index = 0; index < RESOLVED_APPROVALS_MAX + 3; index++) {
      lines = noteResolvedApproval(lines, resolved(`a${index}`, 'denied'));
    }
    expect(lines).toHaveLength(RESOLVED_APPROVALS_MAX);
    expect(lines[0]?.approvalId).toBe('a3');
    expect(lines.at(-1)?.approvalId).toBe(`a${RESOLVED_APPROVALS_MAX + 2}`);
  });

  it('stops being drawn the moment the conversation holds its own line', () => {
    const lines = noteResolvedApproval(
      noteResolvedApproval(NO_RESOLVED_APPROVALS, resolved('a1', 'denied')),
      resolved('a2', 'approved'),
    );
    const before = new BotConversationEntity([], [], 0);
    const after = new BotConversationEntity([storedLine('a1')], [], 1);
    expect(botResolvedApprovals(lines, before)).toBe(lines);
    expect(botResolvedApprovals(lines, after).map((line) => line.approvalId)).toEqual(['a2']);
  });

  it('takes down only the card that closed', () => {
    const card = new BotApprovalEntity('a1', 't1', 'start_session', 'Start', 'pending', null, at);
    expect(withoutClosedApproval(card, 'a1')).toBeNull();
    expect(withoutClosedApproval(card, 'a9')).toBe(card);
    expect(withoutClosedApproval(undefined, 'a1')).toBeUndefined();
  });
});

describe('BotApprovalHold', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a card at once when no line is half written', () => {
    const hold = new BotApprovalHold();
    const show = vi.fn();
    hold.raise(show);
    hold.text('Done.\n');
    hold.raise(show);
    expect(show).toHaveBeenCalledTimes(2);
  });

  it('holds a card raised mid-sentence until the line ends', () => {
    const hold = new BotApprovalHold();
    const show = vi.fn();
    hold.text('I will start a ses');
    hold.raise(show);
    hold.text('sion on build');
    expect(show).not.toHaveBeenCalled();
    hold.text('-02.\nThen');
    expect(show).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(APPROVAL_HOLD_MAX_MS);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('shows it when the text is stored or the turn moves, without a newline', () => {
    const hold = new BotApprovalHold();
    const show = vi.fn();
    hold.text('Asking for approval');
    hold.raise(show);
    hold.lineEnded();
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('never holds it past the cap, however long the sentence runs', () => {
    const hold = new BotApprovalHold();
    const show = vi.fn();
    hold.text('A very long');
    hold.raise(show);
    vi.advanceTimersByTime(APPROVAL_HOLD_MAX_MS - 1);
    hold.text(' sentence that keeps');
    expect(show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('shows nothing once the chat has closed', () => {
    const hold = new BotApprovalHold();
    const show = vi.fn();
    hold.text('Half');
    hold.raise(show);
    hold.dispose();
    vi.advanceTimersByTime(APPROVAL_HOLD_MAX_MS);
    expect(show).not.toHaveBeenCalled();
  });
});
