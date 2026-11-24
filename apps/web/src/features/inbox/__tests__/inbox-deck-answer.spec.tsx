import {
  InboxDeck,
  InboxMessageActions,
  InboxMessageChoices,
  inboxDeckAnswer,
} from '@oppenheimer/design-system-web';
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The digit a person presses on the deck is the answer that wears it, in the
 * order the card draws them: a session's choices first, in the agent's order,
 * then the answer rows, so 1 on a permission is always its first option and
 * Open session comes after them. A disabled answer takes no press.
 */
afterEach(cleanup);

const deck = (body: ReactNode) =>
  render(<InboxDeck data-testid="deck">{body}</InboxDeck>).getByTestId('deck');

describe('inboxDeckAnswer', () => {
  it('numbers the answers in the order the card draws them, the main one first', () => {
    const root = deck(
      <InboxMessageActions>
        <button type="button">Approve</button>
        <button type="button">Deny</button>
      </InboxMessageActions>,
    );
    expect(inboxDeckAnswer(root, 1)?.textContent).toBe('Approve');
    expect(inboxDeckAnswer(root, 2)?.textContent).toBe('Deny');
    expect(inboxDeckAnswer(root, 3)).toBeNull();
  });

  it("numbers a session's choices in the agent's order, then Open session", () => {
    const root = deck(
      <>
        <InboxMessageChoices>
          <button type="button">Yes</button>
          <button type="button">No</button>
        </InboxMessageChoices>
        <InboxMessageActions>
          <button type="button">Open session</button>
        </InboxMessageActions>
      </>,
    );
    expect(inboxDeckAnswer(root, 1)?.textContent).toBe('Yes');
    expect(inboxDeckAnswer(root, 2)?.textContent).toBe('No');
    expect(inboxDeckAnswer(root, 3)?.textContent).toBe('Open session');
    expect(inboxDeckAnswer(root, 4)).toBeNull();
  });

  it('presses nothing for a disabled answer', () => {
    const root = deck(
      <InboxMessageActions>
        <button type="button" disabled>
          Send answers
        </button>
      </InboxMessageActions>,
    );
    expect(inboxDeckAnswer(root, 1)).toBeNull();
  });
});
