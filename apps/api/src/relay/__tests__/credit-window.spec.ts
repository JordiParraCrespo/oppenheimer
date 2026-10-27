/**
 * The sender's half of the link's credit window, as a preview's connection
 * sends under it: it sends while room is left, waits when the window is
 * spent until credit comes back, and a closed attachment releases its waiting
 * writer with the reason rather than leaving it hanging. The runner's
 * `flowWindow` is the same contract in Go.
 */
import { ATTACHMENT_CREDIT_WINDOW_BYTES } from '@oppenheimer/shared/protocol';
import { describe, expect, it } from 'vitest';
import { CreditWindow } from '../infrastructure/credit-window.util';

describe('CreditWindow', () => {
  it('waits once the window is spent, and sends again when credit comes back', async () => {
    const window = new CreditWindow();
    await window.acquire();
    window.sent(ATTACHMENT_CREDIT_WINDOW_BYTES);
    expect(window.room).toBe(0);

    let sent = false;
    const waiting = window.acquire().then(() => {
      sent = true;
    });
    await Promise.resolve();
    expect(sent).toBe(false);

    window.credit(1024);
    await waiting;
    expect(window.room).toBe(1024);
  });

  it('releases a waiting writer with the reason the attachment closed', async () => {
    const window = new CreditWindow();
    window.sent(ATTACHMENT_CREDIT_WINDOW_BYTES);
    const waiting = window.acquire();
    window.close(new Error('link lost'));
    await expect(waiting).rejects.toThrow('link lost');
    await expect(window.acquire()).rejects.toThrow('link lost');
  });
});
