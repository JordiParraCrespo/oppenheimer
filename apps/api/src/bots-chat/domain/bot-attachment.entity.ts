import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_ATTACHMENT_NAME_MAX,
  BOT_IMAGE_MAX_BYTES,
  BOT_IMAGE_MIME_TYPES,
  type BotAttachment,
  type BotImageMimeType,
} from '@oppenheimer/shared';

const HOUR_MS = 60 * 60 * 1000;

/**
 * How long an image no message carries is kept before the daily sweep
 * deletes it: an upload the person may still send, or one whose message is
 * gone.
 */
export const BOT_ATTACHMENT_UNSENT_TTL_MS = 24 * HOUR_MS;

/**
 * How long after its upload an image may still be sent: an hour short of
 * the sweep's age, so an image the sweep has picked to delete is never one a
 * send can claim while its file is being deleted.
 */
export const BOT_ATTACHMENT_SEND_WINDOW_MS = BOT_ATTACHMENT_UNSENT_TTL_MS - HOUR_MS;

export interface BotAttachmentProps {
  organizationId: string;
  botId: string;
  /** Who may send it; null once that account is gone. */
  uploadedByUserId: string | null;
  /** The message that carries it; null until it is sent. */
  messageId: string | null;
  /** Where the file is in storage. */
  storageKey: string;
  mimeType: BotImageMimeType;
  sizeBytes: number;
  /** The file's name as the browser gave it, for the chat's alt text. */
  name: string;
}

/** Whether `mimeType` is one of the image types a bot's chat takes. */
export function isBotImageMimeType(mimeType: string): mimeType is BotImageMimeType {
  return (BOT_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * A file's name as it is kept: its last path segment, without control
 * characters, cut to `BOT_ATTACHMENT_NAME_MAX`. A name is only shown.
 */
export function attachmentName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const printable = [...base].filter((char) => {
    const code = char.charCodeAt(0);
    return code >= 0x20 && code !== 0x7f;
  });
  return printable.join('').trim().slice(0, BOT_ATTACHMENT_NAME_MAX);
}

/**
 * An image uploaded to a bot's chat (`25-bots.md` §3.1): picked in the
 * composer, then carried by the one message it is sent with.
 */
export class BotAttachmentEntity extends AggregateRoot<BotAttachmentProps> {
  static create(create: CreateEntityProps<BotAttachmentProps>): BotAttachmentEntity {
    return new BotAttachmentEntity(create);
  }

  /** A new upload; its key names the workspace, the bot and the attachment itself. */
  static upload(
    props: Omit<BotAttachmentProps, 'messageId' | 'storageKey' | 'name'> & { name: string },
    extension: string,
  ): BotAttachmentEntity {
    const id = randomUUID();
    const attachment = new BotAttachmentEntity({
      id,
      props: {
        ...props,
        name: attachmentName(props.name),
        messageId: null,
        storageKey: `bot-attachments/${props.organizationId}/${props.botId}/${id}.${extension}`,
      },
    });
    attachment.validate();
    return attachment;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get uploadedByUserId(): string | null {
    return this.props.uploadedByUserId;
  }
  get messageId(): string | null {
    return this.props.messageId;
  }
  get storageKey(): string {
    return this.props.storageKey;
  }
  get mimeType(): BotImageMimeType {
    return this.props.mimeType;
  }
  get sizeBytes(): number {
    return this.props.sizeBytes;
  }
  get name(): string {
    return this.props.name;
  }

  /** What a message keeps of it, for the chat. */
  toMessageAttachment(): BotAttachment {
    return { id: this.id, mimeType: this.mimeType, sizeBytes: this.sizeBytes, name: this.name };
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId || !props.storageKey) {
      throw new ArgumentNotProvidedException('An attachment belongs to a bot and is stored');
    }
    if (!isBotImageMimeType(props.mimeType)) {
      throw new ArgumentInvalidException(`${props.mimeType} is not an image a bot takes`);
    }
    if (!Number.isInteger(props.sizeBytes) || props.sizeBytes <= 0) {
      throw new ArgumentInvalidException('An attachment has bytes');
    }
    if (props.sizeBytes > BOT_IMAGE_MAX_BYTES) {
      throw new ArgumentInvalidException('An attachment is at most BOT_IMAGE_MAX_BYTES');
    }
  }
}
