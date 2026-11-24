/**
 * The `use_computer` call as the host is asked it: the link's names, and
 * only what the action takes. The tool's own spec covers the rest of a call.
 */
import { computerActSchema } from '@oppenheimer/shared/protocol';
import { COMPUTER_ACTION_SPECS } from '../application/bot-computer.policy';
import { toHostComputerRequest } from '../bot-computer-tool.mapper';

describe('toHostComputerRequest', () => {
  it('names a drag and a scroll as the link does', () => {
    expect(toHostComputerRequest({ action: 'drag', x: 0, y: 5, to_x: 9, to_y: 0 })).toEqual({
      action: 'drag',
      x: 0,
      y: 5,
      toX: 9,
      toY: 0,
    });
    expect(toHostComputerRequest({ action: 'scroll', x: 1, y: 2, scroll_y: -3 })).toEqual({
      action: 'scroll',
      x: 1,
      y: 2,
      scrollY: -3,
    });
  });

  // A model often leaves the last click's x and y on its next call: typed
  // text must not travel with a place it was never meant for.
  it('leaves behind what the action has no use for', () => {
    expect(toHostComputerRequest({ action: 'type', text: 'hi', x: 4, y: 4, seconds: 3 })).toEqual({
      action: 'type',
      text: 'hi',
    });
    expect(toHostComputerRequest({ action: 'wait', seconds: 3, text: 'hi' })).toEqual({
      action: 'wait',
      seconds: 3,
    });
  });

  // Every action the table holds must come out as a frame the link accepts:
  // a row added with a field the wire does not know fails here.
  it('makes a computer.act the link accepts for every action', () => {
    const full = {
      x: 1,
      y: 2,
      to_x: 3,
      to_y: 4,
      scroll_x: 1,
      scroll_y: 1,
      text: 't',
      keys: ['enter'],
      seconds: 1,
    };
    const actions = Object.keys(COMPUTER_ACTION_SPECS) as (keyof typeof COMPUTER_ACTION_SPECS)[];
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      const frame = {
        type: 'computer.act',
        commandId: 'b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
        ...toHostComputerRequest({ action, ...full }),
      };
      expect(computerActSchema.strict().safeParse(frame).success).toBe(true);
    }
  });
});
