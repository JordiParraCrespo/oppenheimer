import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDialogSlot, type DialogSlotActions } from './dialog-slot';

afterEach(cleanup);

type Request = { kind: 'a' } | { kind: 'b'; id: string };

describe('createDialogSlot', () => {
  it('re-renders the request reader on open and close, and never the actions reader', () => {
    const slot = createDialogSlot<Request>('useTestDialog');
    let asker = 0;
    let actions: DialogSlotActions<Request> | undefined;
    function Asker() {
      asker++;
      actions = slot.useDialogActions();
      return null;
    }
    function Owner() {
      const request = slot.useDialogRequest();
      return <p>{request ? request.kind : 'none'}</p>;
    }
    render(
      <slot.DialogSlotProvider>
        <Asker />
        <Owner />
      </slot.DialogSlotProvider>,
    );
    const first = actions;
    expect(screen.getByText('none')).toBeTruthy();

    act(() => actions?.open({ kind: 'b', id: '1' }));
    expect(screen.getByText('b')).toBeTruthy();
    act(() => actions?.close());
    expect(screen.getByText('none')).toBeTruthy();

    expect(asker).toBe(1);
    expect(actions).toBe(first);
  });

  it('names itself when used outside its provider', () => {
    const slot = createDialogSlot<Request>('useTestDialog');
    function Asker() {
      slot.useDialogActions();
      return null;
    }
    expect(() => render(<Asker />)).toThrow(/useTestDialog/);
  });
});
