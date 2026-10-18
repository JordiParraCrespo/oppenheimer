/** A device code ChatGPT handed out: what the person types, and what the API polls with. */
export interface ChatgptDeviceCode {
  /** The poll's handle on the sign-in. A live credential while it lasts: never logged. */
  deviceAuthId: string;
  /** What the person types on `verificationUrl`. */
  userCode: string;
  verificationUrl: string;
  /** How often ChatGPT allows a poll. */
  intervalSeconds: number;
}

/** A ChatGPT sign-in's tokens. Live credentials: sealed at rest, never logged or returned. */
export interface ChatgptTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  /** The ChatGPT account the token acts for, from the token's own claims. */
  accountId: string;
}

export type ChatgptDevicePoll =
  | { status: 'pending' }
  | { status: 'authorized'; tokens: ChatgptTokens };

/**
 * ChatGPT refused a token request outright: a refresh token that was revoked
 * or already used, a device code it no longer knows. Signing in again is the
 * only way on; a network failure or a rate limit is not this.
 */
export class ChatgptAuthRefusedError extends Error {}

/**
 * Signing in to ChatGPT the way the Codex CLI does (`product/versions/mvp/25-bots.md`
 * §2): the device code flow, since the browser-redirect one only ever lands on
 * `localhost`, and the refresh of the tokens it yields.
 */
export interface ChatgptAuthPort {
  requestDeviceCode(): Promise<ChatgptDeviceCode>;
  /** One poll: still waiting for the person, or their tokens. */
  pollDeviceCode(
    code: Pick<ChatgptDeviceCode, 'deviceAuthId' | 'userCode'>,
  ): Promise<ChatgptDevicePoll>;
  /** New tokens for `refreshToken`. ChatGPT rotates it: the old one is spent. */
  refresh(refreshToken: string): Promise<ChatgptTokens>;
}
