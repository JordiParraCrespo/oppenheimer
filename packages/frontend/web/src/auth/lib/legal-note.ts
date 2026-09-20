import type { ParseKeys } from 'i18next';

/**
 * The legal one-liner pinned to the bottom of the auth panel, outside the
 * centred form column where a page renders. A page declares the key as route
 * `staticData` and `AuthLayout` reads it off the innermost match, so no page
 * reaches up into the layout's state to register a line.
 */
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    legalNoteKey?: ParseKeys;
    /**
     * How wide the centred column is: `form` (340px, the auth forms), `wide`
     * (400px, the onboarding steps) or `panel` (620px, Add your first host,
     * whose two code cards sit side by side). Read by `AuthLayout` off the
     * innermost match, like the legal note.
     */
    authWidth?: 'form' | 'wide' | 'panel';
  }
}
