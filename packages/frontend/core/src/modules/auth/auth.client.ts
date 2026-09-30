import type { Role } from '@oppenheimer/shared';

export interface AuthSessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  emailVerified: boolean;
}

export interface AuthSession {
  user: AuthSessionUser;
}

export interface SignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export type SocialProvider = 'google' | 'github';

/**
 * What the caller means by starting an OAuth round-trip.
 *
 * The API refuses to mint an account from a bare sign-in
 * (`disableImplicitSignUp`), so a provider identity it has never seen is
 * rejected unless the caller asked for a sign-up. Both intents still *sign in*
 * an identity that already exists — including one that only exists as an
 * email/password account, which the API links on the way through. The intent
 * decides one thing: whether an unknown identity may become a new account.
 */
export type SocialAuthIntent = 'sign-in' | 'sign-up';

/**
 * Each app builds a Better Auth client with the plugins its platform needs
 * (browser cookies on web), adapts it to this interface and binds it in the DI
 * container. Keeping the boundary here means the rest of the frontend package
 * never imports `better-auth` directly.
 */
export interface IAuthClient {
  /** Rejects on failure. */
  signIn(email: string, password: string): Promise<void>;
  /** Rejects on failure. */
  signUp(params: SignUpParams): Promise<void>;
  /**
   * Start the OAuth flow for a social provider. On web this redirects the
   * browser to the provider and back.
   *
   * `intent` defaults to `'sign-in'`, which the API refuses for an identity
   * that has no account here. Only the register screens pass `'sign-up'`.
   */
  signInSocial(provider: SocialProvider, intent?: SocialAuthIntent): Promise<void>;
  signOut(): Promise<void>;
  /** Send a password reset email. */
  forgotPassword(email: string): Promise<void>;
  /** Complete a password reset using the token from the reset email. */
  resetPassword(token: string, newPassword: string): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  /**
   * Extra headers used to authenticate non-auth REST calls (the generated
   * `@oppenheimer/api-client`). On web it is empty and the browser sends
   * cookies; a client with no cookie jar would carry the session here.
   */
  getAuthHeaders(): Promise<Record<string, string>>;
}
