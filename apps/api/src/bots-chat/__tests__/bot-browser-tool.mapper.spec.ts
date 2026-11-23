/**
 * The `use_browser` call as the host is asked it: the link's names, only
 * what the action takes, and a picture only when one was asked for. The
 * tool's own spec covers the rest of a call.
 */
import { browserActSchema } from '@oppenheimer/shared/protocol';
import { BROWSER_ACTION_SPECS } from '../application/bot-browser.policy';
import { toHostBrowserRequest } from '../bot-browser-tool.mapper';

describe('toHostBrowserRequest', () => {
  it('names whose browser, and a scroll as the link does', () => {
    expect(toHostBrowserRequest({ action: 'scroll', scroll_y: -3 }, 'juno', true)).toEqual({
      browser: 'juno',
      action: 'scroll',
      scrollY: -3,
      picture: true,
    });
  });

  // A model often leaves the last click's x and y on its next call. A ref is
  // what it meant: the point must not travel with it, or with typed text.
  it('sends a ref without a stale point, and leaves behind what the action has no use for', () => {
    expect(
      toHostBrowserRequest({ action: 'click', ref: 'e7', x: 40, y: 50 }, 'juno', false),
    ).toEqual({ browser: 'juno', action: 'click', ref: 'e7' });
    expect(
      toHostBrowserRequest(
        { action: 'type', ref: 'e2', text: 'hi', url: 'https://a.example' },
        'juno',
        false,
      ),
    ).toEqual({ browser: 'juno', action: 'type', ref: 'e2', text: 'hi' });
    expect(toHostBrowserRequest({ action: 'click', x: 0, y: 5 }, 'juno', false)).toEqual({
      browser: 'juno',
      action: 'click',
      x: 0,
      y: 5,
    });
  });

  it('asks for no picture of a browser it is closing', () => {
    expect(toHostBrowserRequest({ action: 'close' }, 'juno', true)).toEqual({
      browser: 'juno',
      action: 'close',
    });
  });

  // Every action the table holds must come out as a frame the link accepts:
  // a row added with a field the wire does not know fails here.
  it('makes a browser.act the link accepts for every action', () => {
    const full = {
      url: 'https://example.com',
      ref: 'e1',
      x: 1,
      y: 2,
      scroll_y: 1,
      text: 't',
      keys: ['enter'],
      seconds: 1,
    };
    const actions = Object.keys(BROWSER_ACTION_SPECS) as (keyof typeof BROWSER_ACTION_SPECS)[];
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      const frame = {
        type: 'browser.act',
        commandId: 'b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
        ...toHostBrowserRequest({ action, ...full }, 'juno-3f2a', true),
      };
      expect(browserActSchema.strict().safeParse(frame).success).toBe(true);
    }
  });
});
