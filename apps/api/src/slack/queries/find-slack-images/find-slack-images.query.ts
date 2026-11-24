import { QueryBase } from '@oppenheimer/backend-ddd';
import type { SlackImage } from '../../domain/slack-inbound.policy';

/**
 * The images the owner shared with a bot's Slack app, fetched as that app:
 * the bytes of each, for the bot to read with the owner's message.
 */
export class FindSlackImagesQuery extends QueryBase {
  readonly organizationId: string;
  readonly accountId: string;
  /** The Oppenheimer bot whose turn they are for: it must still be the app's. */
  readonly botId: string;
  readonly images: readonly SlackImage[];
  /** The most bytes one image may have; a larger one is not fetched. */
  readonly maxBytes: number;

  constructor(props: {
    organizationId: string;
    accountId: string;
    botId: string;
    images: readonly SlackImage[];
    maxBytes: number;
  }) {
    super();
    this.organizationId = props.organizationId;
    this.accountId = props.accountId;
    this.botId = props.botId;
    this.images = props.images;
    this.maxBytes = props.maxBytes;
  }
}

/** One image fetched; `bytes` are as Slack served them, judged by the caller. */
export interface SlackImageFetched {
  name: string;
  bytes: Buffer;
}
