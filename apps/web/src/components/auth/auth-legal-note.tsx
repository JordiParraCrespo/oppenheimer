import { createContext, useContext, useEffect } from 'react';

/**
 * The legal one-liner is pinned to the bottom of the auth panel, outside the
 * centred form column, so it cannot live in the page component's own markup.
 * Pages register their line here and the layout renders it.
 */
const AuthLegalNoteContext = createContext<(note: string | null) => void>(() => {});

export const AuthLegalNoteProvider = AuthLegalNoteContext.Provider;

export function useAuthLegalNote(note: string) {
  const setNote = useContext(AuthLegalNoteContext);

  useEffect(() => {
    setNote(note);
    return () => setNote(null);
  }, [setNote, note]);
}
