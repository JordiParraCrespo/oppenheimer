import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { WHATSAPP_LABEL_MAX, type WhatsappAccountStatus } from '@oppenheimer/shared';

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
}

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
