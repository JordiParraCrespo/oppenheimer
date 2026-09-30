import { createContext, type ReactNode, useContext, useState } from 'react';

/** What a surface does with the slot: ask for a dialog, or put it away. */
export interface DialogSlotActions<TRequest> {
  open: (request: TRequest) => void;
  close: () => void;
}

/** The slot's two halves, one hook each, and the provider that owns both. */
export interface DialogSlot<TRequest> {
  DialogSlotProvider: (props: { children: ReactNode }) => ReactNode;
  /** `open` and `close`: one identity for the provider's life, so asking re-renders nothing. */
  useDialogActions: () => DialogSlotActions<TRequest>;
  /** The dialog that is up, if one is; read only by what mounts the dialogs. */
  useDialogRequest: () => TRequest | null;
}

/**
 * One slot for an app's dialogs: at most one is up, any surface below the
 * provider requests one, and one owner mounts it. The app names the requests
 * (`TRequest`); the kit knows none of them.
 *
 * Actions and request are two contexts because they change at different
 * rates: every opener reads `open`, which never changes, and only the owner
 * reads the request. One context re-rendered every sidebar and row that could
 * open a dialog each time one did.
 */
export function createDialogSlot<TRequest>(name: string): DialogSlot<TRequest> {
  const ActionsContext = createContext<DialogSlotActions<TRequest> | null>(null);
  // `undefined` is outside the provider; `null` is the provider saying no dialog is up.
  const RequestContext = createContext<TRequest | null | undefined>(undefined);

  function DialogSlotProvider({ children }: { children: ReactNode }) {
    const [request, setRequest] = useState<TRequest | null>(null);
    const [actions] = useState<DialogSlotActions<TRequest>>(() => ({
      open: (next) => setRequest(() => next),
      close: () => setRequest(null),
    }));
    return (
      <ActionsContext.Provider value={actions}>
        <RequestContext.Provider value={request}>{children}</RequestContext.Provider>
      </ActionsContext.Provider>
    );
  }

  return {
    DialogSlotProvider,
    useDialogActions() {
      const actions = useContext(ActionsContext);
      if (!actions) throw new Error(`${name}: used outside its DialogSlotProvider`);
      return actions;
    },
    useDialogRequest() {
      const request = useContext(RequestContext);
      // Thrown, not read as "none is up": a mis-mounted owner would otherwise
      // render no dialog and say nothing.
      if (request === undefined) throw new Error(`${name}: used outside its DialogSlotProvider`);
      return request;
    },
  };
}
