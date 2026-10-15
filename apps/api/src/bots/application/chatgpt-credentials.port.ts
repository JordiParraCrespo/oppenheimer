/** What a `chatgpt` turn runs on: a live access token and the account it acts for. Never logged. */
export interface ChatgptAccess {
  accessToken: string;
  accountId: string;
}

/** A workspace's ChatGPT sign-in, as the turn worker reads it (`CHATGPT_CREDENTIALS`). */
export interface ChatgptCredentialsPort {
  /** The access a turn runs on, refreshed first when it is about to lapse; `BOTS_013` when there is none. */
  accessFor(organizationId: string, now: Date): Promise<ChatgptAccess>;
}
