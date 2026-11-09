import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { WHATSAPP_LABEL_MAX, type WhatsappAccountStatus } from '@oppenheimer/shared';
import {
  generateWhatsappOwnerCode,
  hashWhatsappOwnerCode,
  isWhatsappPhoneJid,
  WHATSAPP_OWNER_CODE_ATTEMPTS,
  WHATSAPP_OWNER_CODE_TTL_MS,
} from './whatsapp-owner-code.policy';

export interface WhatsappAccountProps {
  organizationId: string;
  /** Whose number it is. Only they, and their bots, read and write in it. */
  userId: string;
  /** The host whose runner holds the linked device and its keys. One device per host. */
  hostId: string;
  /** What the person and their bots call it: "Spare", "Shop". */
  label: string;
  status: WhatsappAccountStatus;
  /** The paired number's JID, once paired. */
  phone: string | null;
  /** The paired account's own WhatsApp name. */
  displayName: string | null;
  /** The QR code to scan while pairing, and when it stops being valid. */
  qr: string | null;
  qrExpiresAt: Date | null;
  /** Why it is logged out or unlinked, in the runner's words. */
  statusReason: string | null;
  /**
   * The Oppenheimer bot that answers the owner here by default
   * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1); null
   * while none does. A switch by name ("Shop: …") overrides it per chat.
   */
  answeringBotId: string | null;
  /** The owner's own number, as its JID, once the code sent to it was entered. */
  ownerPhone: string | null;
  /** The number a code was sent to, its SHA-256 and when it stops working; all null when none waits. */
  ownerPendingPhone: string | null;
  ownerCodeHash: string | null;
  ownerCodeExpiresAt: Date | null;
  /** Wrong codes entered for the waiting one. */
  ownerCodeAttempts: number;
}

/** What entering a code came to (`confirmOwner`). */
export type WhatsappOwnerConfirmation = 'confirmed' | 'wrong' | 'expired' | 'locked' | 'none';

/** What the runner reported about its device (`whatsapp.state`). */
export interface WhatsappDeviceReport {
  state: WhatsappAccountStatus;
  qr?: string;
  qrExpiresAt?: Date;
  phone?: string;
  name?: string;
  reason?: string;
}

/**
 * A number the person owns, joined as a WhatsApp linked device by the runner
 * on one of their hosts (`product/next-steps/whatsapp.md`). The keys stay on
 * the host; this is what the control plane knows of it: where it lives, what
 * it is called, and how the host last said it stands.
 */
export class WhatsappAccountEntity extends AggregateRoot<WhatsappAccountProps> {
  /** A report of another paired number forgot the owner: the next save writes that. */
  private forgotOwner = false;

  static create(create: CreateEntityProps<WhatsappAccountProps>): WhatsappAccountEntity {
    return new WhatsappAccountEntity(create);
  }

  /** A new number on a host, waiting for the phone to scan its first QR code. */
  static link(props: {
    organizationId: string;
    userId: string;
    hostId: string;
    label: string;
  }): WhatsappAccountEntity {
    return new WhatsappAccountEntity({
      id: randomUUID(),
      props: {
        ...props,
        label: props.label.trim() || 'WhatsApp',
        status: 'pairing',
        phone: null,
        displayName: null,
        qr: null,
        qrExpiresAt: null,
        statusReason: null,
        answeringBotId: null,
        ownerPhone: null,
        ownerPendingPhone: null,
        ownerCodeHash: null,
        ownerCodeExpiresAt: null,
        ownerCodeAttempts: 0,
      },
    });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get hostId(): string {
    return this.props.hostId;
  }
  get label(): string {
    return this.props.label;
  }
  get status(): WhatsappAccountStatus {
    return this.props.status;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get displayName(): string | null {
    return this.props.displayName;
  }
  get qr(): string | null {
    return this.props.qr;
  }
  get qrExpiresAt(): Date | null {
    return this.props.qrExpiresAt;
  }
  get statusReason(): string | null {
    return this.props.statusReason;
  }
  get isConnected(): boolean {
    return this.props.status === 'connected';
  }
  get answeringBotId(): string | null {
    return this.props.answeringBotId;
  }
  get ownerPhone(): string | null {
    return this.props.ownerPhone;
  }
  get ownerPendingPhone(): string | null {
    return this.props.ownerPendingPhone;
  }
  get ownerCodeHash(): string | null {
    return this.props.ownerCodeHash;
  }
  get ownerCodeExpiresAt(): Date | null {
    return this.props.ownerCodeExpiresAt;
  }
  get ownerCodeAttempts(): number {
    return this.props.ownerCodeAttempts;
  }

  /** Whether a report forgot the owner since it was loaded (`report`). */
  get ownerForgotten(): boolean {
    return this.forgotOwner;
  }

  /** Whether a sender is the owner this number confirmed. */
  isOwner(senderId: string): boolean {
    return this.props.ownerPhone !== null && this.props.ownerPhone === senderId;
  }

  /** The Oppenheimer bot that answers here by default from now on; null for none. */
  answerAs(botId: string | null): void {
    this.props.answeringBotId = botId;
    this.setUpdatedAt(new Date());
  }

  /**
   * The owner names their own number (`<digits>@s.whatsapp.net`): a new
   * six-digit code, which only this request sees, waits to be entered for
   * `WHATSAPP_OWNER_CODE_TTL_MS`, replacing any waiting one. The confirmed
   * owner stays until another number is confirmed. Null, changing nothing,
   * for what cannot be the owner's: not a phone number, or this number itself.
   */
  nameOwner(jid: string, now: Date): { code: string; expiresAt: Date } | null {
    if (!isWhatsappPhoneJid(jid) || jid === this.props.phone) return null;
    const code = generateWhatsappOwnerCode();
    const expiresAt = new Date(now.getTime() + WHATSAPP_OWNER_CODE_TTL_MS);
    this.props.ownerPendingPhone = jid;
    this.props.ownerCodeHash = hashWhatsappOwnerCode(code);
    this.props.ownerCodeExpiresAt = expiresAt;
    this.props.ownerCodeAttempts = 0;
    this.setUpdatedAt(now);
    return { code, expiresAt };
  }

  /** The waiting code goes unsent (the send failed): nothing waits any more. */
  forgetOwnerCode(): void {
    this.props.ownerPendingPhone = null;
    this.props.ownerCodeHash = null;
    this.props.ownerCodeExpiresAt = null;
    this.props.ownerCodeAttempts = 0;
  }

  /**
   * A code entered in Settings: the waiting one, before it expires and
   * before `WHATSAPP_OWNER_CODE_ATTEMPTS` wrong tries, makes its number the
   * owner and is used up. A wrong one counts a try; once the tries are
   * spent the code is locked, the right one included, until a new one.
   */
  confirmOwner(code: string, now: Date): WhatsappOwnerConfirmation {
    const { ownerPendingPhone, ownerCodeHash, ownerCodeExpiresAt } = this.props;
    if (!ownerPendingPhone || !ownerCodeHash || !ownerCodeExpiresAt) return 'none';
    if (this.props.ownerCodeAttempts >= WHATSAPP_OWNER_CODE_ATTEMPTS) return 'locked';
    if (ownerCodeExpiresAt <= now) return 'expired';
    if (hashWhatsappOwnerCode(code) !== ownerCodeHash) {
      this.props.ownerCodeAttempts += 1;
      return 'wrong';
    }
    this.props.ownerPhone = ownerPendingPhone;
    this.forgetOwnerCode();
    this.setUpdatedAt(now);
    return 'confirmed';
  }

  /** Pair again: a fresh QR is on its way from the host. The label stays. */
  repair(label?: string): void {
    if (label?.trim()) this.props.label = label.trim();
    this.props.status = 'pairing';
    this.props.qr = null;
    this.props.qrExpiresAt = null;
    this.props.statusReason = null;
    this.validate();
    this.setUpdatedAt(new Date());
  }

  /**
   * The host's report replaces what was known. A QR is kept only while
   * pairing; the number and its name are kept once learned, so a reconnect
   * that does not repeat them does not forget them.
   */
  report(report: WhatsappDeviceReport): void {
    this.props.status = report.state;
    const pairing = report.state === 'pairing';
    this.props.qr = pairing ? (report.qr ?? null) : null;
    this.props.qrExpiresAt = pairing ? (report.qrExpiresAt ?? null) : null;
    // Another number paired on this account has never confirmed its owner:
    // the owner and any waiting code belong to the number they were named on.
    if (report.phone && this.props.phone && report.phone !== this.props.phone) {
      this.props.ownerPhone = null;
      this.forgetOwnerCode();
      this.forgotOwner = true;
    }
    if (report.phone) this.props.phone = report.phone;
    if (report.name) this.props.displayName = report.name;
    this.props.statusReason = report.reason ?? null;
    this.setUpdatedAt(new Date());
  }

  public validate(): void {
    const { label } = this.props;
    if (!label || label.length > WHATSAPP_LABEL_MAX) {
      throw new ArgumentInvalidException(`label must be 1 to ${WHATSAPP_LABEL_MAX} characters`);
    }
  }
}
