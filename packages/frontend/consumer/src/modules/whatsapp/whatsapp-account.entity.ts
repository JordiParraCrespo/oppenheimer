/** How a linked number stands, as its host last reported its device. */
export type WhatsappAccountStatus =
  | 'pairing'
  | 'connecting'
  | 'connected'
  | 'logged_out'
  | 'unlinked';

/** Where naming the reader's own number stands; see {@link WhatsappAccountEntity.ownerState}. */
export type WhatsappOwnerState = 'none' | 'codeSent' | 'confirmed';

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
    /**
     * The reader's Oppenheimer bot that answers them on this number by
     * default (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1);
     * null while none does. "Name: …" in the chat switches to another.
     */
    public readonly answeringBotId: string | null = null,
    /** The reader's own number, confirmed by a code, as `+digits`: the only one answered here. */
    public readonly ownerNumber: string | null = null,
    /** The number a code was sent to and waits to be entered, as `+digits`. */
    public readonly ownerPendingNumber: string | null = null,
    /** When that code stops working; the API keeps it past then, so the console decides. */
    public readonly ownerCodeExpiresAt: Date | null = null,
  ) {}

  /**
   * Where naming the reader's own number stands: a code is waiting to be
   * entered (even while an earlier number is still the owner, until the new
   * one is confirmed), a number is confirmed, or neither.
   */
  get ownerState(): WhatsappOwnerState {
    if (this.ownerPendingNumber !== null && this.ownerCodeExpiresAt !== null) return 'codeSent';
    return this.ownerNumber !== null ? 'confirmed' : 'none';
  }

  /** Whether the waiting code has stopped working at `now` (ms); false when none waits. */
  codeExpired(now: number): boolean {
    return this.ownerCodeExpiresAt !== null && this.ownerCodeExpiresAt.getTime() <= now;
  }

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
