import type { DragItem } from '@oppenheimer/design-system-web';
import { BotEntity } from '@oppenheimer/frontend-consumer';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSectionBotOrder } from '../hooks/use-section-bot-order';

/**
 * What a drop under a section's Bots heading keeps: it is saved as the bot's
 * place in the Employees order (group and position), drawn where it was
 * dropped until the write settles, and put back when it fails. A drop that
 * leaves the bot where it was writes nothing. Where in Employees a drop lands
 * is `section-order.spec.ts`.
 */

type Callbacks = { onSettled?: () => void };
const mutate = vi.hoisted(() =>
  vi.fn<(variables: { id: string; input: unknown }, callbacks: Callbacks) => void>(),
);
const everyBot = vi.hoisted(() => ({ bots: [] as unknown[] }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useUpdateBot: () => ({ mutate, error: null, reset: vi.fn() }),
  useBotsSnapshot: () => () => everyBot.bots,
}));

function bot(id: string, groupId: string | null, position: number): BotEntity {
  const at = new Date('2026-10-29T09:00:00Z');
  return new BotEntity(
    id,
    id,
    '',
    'mint',
    groupId,
    position,
    null,
    'anthropic',
    null,
    null,
    'auto',
    true,
    at,
    at,
    at,
    null,
    ['pulls'],
  );
}

// Employees: Ops [a, hidden, b], then Ungrouped [c]; Pull requests lists a, b, c.
const A = bot('a', 'ops', 0);
const B = bot('b', 'ops', 2);
const C = bot('c', null, 0);
const LISTED = [A, B, C];
const item = (id: string): DragItem => ({ id, data: { type: 'bot' } });

function setup() {
  const hook = renderHook(() => useSectionBotOrder('pulls', LISTED));
  const drag = (id: string, over: string) =>
    act(() => {
      const { handlers } = hook.result.current;
      handlers.onDragStart(item(id));
      handlers.onDragOver({ active: item(id), over: item(over) });
      handlers.onDragEnd({ active: item(id), over: item(over) });
    });
  const drawn = () => hook.result.current.bots.map((each) => each.id);
  return { drag, drawn };
}

beforeEach(() => {
  mutate.mockReset();
  everyBot.bots = [A, bot('hidden', 'ops', 1), B, C];
});

describe('useSectionBotOrder', () => {
  it('saves a drop as the bot’s place in Employees and draws it there while the write is in flight', () => {
    const { drag, drawn } = setup();
    drag('b', 'a');
    expect(mutate).toHaveBeenCalledOnce();
    // b dropped above a: before a in Ops, ahead of the bot this section hides.
    expect(mutate.mock.calls[0]?.[0]).toEqual({ id: 'b', input: { groupId: 'ops', position: 0 } });
    expect(drawn()).toEqual(['b', 'a', 'c']);
  });

  it('goes back to the list as read once the write settles, landed or failed', () => {
    const { drag, drawn } = setup();
    drag('c', 'a');
    expect(drawn()).toEqual(['c', 'a', 'b']);
    act(() => mutate.mock.calls[0]?.[1].onSettled?.());
    expect(drawn()).toEqual(['a', 'b', 'c']);
  });

  it('writes nothing for a drop where the bot already was', () => {
    const { drag, drawn } = setup();
    drag('a', 'a');
    expect(mutate).not.toHaveBeenCalled();
    expect(drawn()).toEqual(['a', 'b', 'c']);
  });
});
