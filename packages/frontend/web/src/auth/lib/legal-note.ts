import type { ParseKeys } from 'i18next';

/**
 * What a page under the auth layout may say about how it is framed. Each one
 * is route `staticData`, read by `AuthLayout` off the innermost match that
 * declares it, so a page overrides its layout and no page reaches up into the
 * layout's state to register anything.
 */
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * The legal one-liner pinned under the centred column. A page that names
     * no key and does not switch the line off gets the terms-and-privacy one.
     */
    legalNoteKey?: ParseKeys;
    /**
     * How wide the centred column is: `form` (340px, the auth forms), `wide`
     * (400px, the onboarding steps) or `panel` (620px, Add your first host,
     * whose two code cards sit side by side).
     */
    authWidth?: 'form' | 'wide' | 'panel';
    /**
     * Whether the legal line is under the column at all. The auth forms carry
     * it; the onboarding screens, reached once the account exists, do not.
     */
    authLegal?: boolean;
  }
}
