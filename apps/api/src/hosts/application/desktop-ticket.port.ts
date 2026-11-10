/** The Redis namespace of desktop tickets, `desktop:<random>`. */
export const DESKTOP_TICKET_PREFIX = 'desktop:';

/** The path the console opens a desktop's socket on, on this API's own origin. */
export const DESKTOP_SOCKET_PATH = '/api/v1/relay/desktop';

/**
 * What a desktop ticket authorises, as `IssueDesktopTicketCommandHandler`
 * stores it and the relay reads it back on redemption: one person watching
 * one host's desktop, judged in one workspace. Published here, beside the
 * port that re-checks it (`HostAccessPort.assertUsable`), because the two
 * are one contract.
 */
export interface DesktopTicket {
  hostId: string;
  organizationId: string;
  userId: string;
}
