/** How a linked number stands, as its host last reported its device. */
export type WhatsappAccountStatus =
  | 'pairing'
  | 'connecting'
  | 'connected'
  | 'logged_out'
  | 'unlinked';

/**
 * One of the reader's own WhatsApp numbers, linked as a device on one of
 * their hosts for their bots (`product/next-steps/whatsapp.md` §1). Its keys
 * stay on the host; this is how the device stands and, while it pairs, the QR
 * code to scan.
 */
export class WhatsappAccountEntity {
  constructor(
    public readonly id: string,
    public readonly hostId: string,
    /** What the reader and their bots call it: "Spare", "Shop". */
    public readonly label: string,
    public readonly status: WhatsappAccountStatus,
    /** Whether the host's runner is connected now; nothing moves while it is not. */
    public readonly hostOnline: boolean,
    /** The paired number's JID (`34600111222@s.whatsapp.net`), once paired. */
    public readonly phone: string | null,
    public readonly displayName: string | null,
    public readonly qr: string | null,
    public readonly qrExpiresAt: Date | null,
    public readonly statusReason: string | null,
    public readonly linkedAt: string,
  ) {}

  /** The number as a person writes it (`+34600111222`), or null before it is paired. */
  get number(): string | null {
    if (!this.phone) return null;
    const [user, server] = this.phone.split('@');
    return server === 's.whatsapp.net' && user ? `+${user.split(':')[0]}` : null;
  }

  /** Waiting for the phone to scan a code: the page keeps asking how it stands. */
  get isPairing(): boolean {
    return this.status === 'pairing';
  }

  /** The device is gone (logged out, unlinked) and the reader pairs it again. */
  get needsPairing(): boolean {
    return this.status === 'logged_out' || this.status === 'unlinked';
  }
}
