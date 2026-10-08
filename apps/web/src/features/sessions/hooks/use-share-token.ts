import { useState } from 'react';
import { readShareToken } from '../lib/share-links';

/**
 * The share link's secret, read once when the page opens: from the URL's
 * fragment, or from where it was set aside for a sign-in. Held for the page's
 * life, so a later change to the fragment does not swap the terminal.
 */
export function useShareToken(): string | null {
  const [token] = useState(readShareToken);
  return token;
}
