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
 * The digit a person presses on the deck is the answer that wears it: a
 * session's choices in their order, else the answer row's right side, and
 * never the row's leading controls (Later, Open session), so 1 on an
 * approval can never put it off instead. A disabled answer takes no press.
 */
afterEach(cleanup);

const deck = (body: ReactNode) =>
  render(<InboxDeck data-testid="deck">{body}</InboxDeck>).getByTestId('deck');

describe('inboxDeckAnswer', () => {
  it("numbers the answer row's right side, not its leading controls", () => {
    const root = deck(
      <InboxMessageActions leading={<button type="button">Later</button>}>
        <button type="button">Deny</button>
        <button type="button">Approve</button>
      </InboxMessageActions>,
    );
    expect(inboxDeckAnswer(root, 1)?.textContent).toBe('Deny');
    expect(inboxDeckAnswer(root, 2)?.textContent).toBe('Approve');
    expect(inboxDeckAnswer(root, 3)).toBeNull();
  });

  it("numbers a session's choices in the order the agent offers them", () => {
    const root = deck(
      <>
        <InboxMessageChoices>
          <button type="button">Yes</button>
          <button type="button">No</button>
        </InboxMessageChoices>
        <InboxMessageActions leading={<button type="button">Open session</button>} />
      </>,
    );
    expect(inboxDeckAnswer(root, 1)?.textContent).toBe('Yes');
    expect(inboxDeckAnswer(root, 2)?.textContent).toBe('No');
    expect(inboxDeckAnswer(root, 3)).toBeNull();
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
