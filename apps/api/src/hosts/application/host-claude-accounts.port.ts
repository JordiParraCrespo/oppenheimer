/**
 * Which hosts share a claude.ai account, read off each host's last inventory
 * (`claudeAccount`, the account its `claude` is signed in as). A Claude Code
 * cloud session runs on the account of the host that started it, so only a
 * host signed in to that same account can send the session a message
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session").
 */
export interface HostClaudeAccountsPort {
  /**
   * The paired hosts signed in to the claude.ai account `hostId` is: `hostId`
   * itself first, then those `ownerUserId` owns. Empty when `hostId` is gone,
   * unpaired, or signed in to no account.
   */
  signedInLike(hostId: string, ownerUserId: string): Promise<string[]>;
}
