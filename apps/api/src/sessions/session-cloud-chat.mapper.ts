import type { CloudChatSource } from '@oppenheimer/shared';
import type {
  BrowserCloudReply,
  CloudChatLine,
  CloudChatReply,
} from './database/session-cloud-chat.repository.port';
import type {
  ClaimedCloudRepliesResponseDto,
  CloudChatReplyResponseDto,
  CloudChatResponseDto,
} from './dtos/session-cloud-chat.response.dto';

/** A cloud session's chat as the console reads it (`GET /sessions/{id}/cloud-chat`). */
export class SessionCloudChatMapper {
  static toReply(reply: CloudChatReply): CloudChatReplyResponseDto {
    return {
      id: reply.id,
      text: reply.text,
      authorId: reply.authorId,
      createdAt: reply.createdAt,
      collectedAt: reply.collectedAt,
      deliveredVia: reply.deliveredVia,
    };
  }

  /** `next` is where the next read starts: after the last line held, or where this one started. */
  static toChat(
    from: number,
    source: CloudChatSource,
    lines: readonly CloudChatLine[],
    replies: readonly CloudChatReply[],
  ): CloudChatResponseDto {
    const last = lines.at(-1);
    return {
      lines: lines.map((each) => each.line),
      next: last ? last.seq + 1 : from,
      source,
      replies: replies.map((reply) => SessionCloudChatMapper.toReply(reply)),
    };
  }

  /** What the browser extension posts for each reply it claimed. */
  static toClaimed(replies: readonly BrowserCloudReply[]): ClaimedCloudRepliesResponseDto {
    return {
      replies: replies.map((reply) => ({
        id: reply.id,
        cloudSessionId: reply.cloudSessionId,
        text: reply.text,
      })),
    };
  }
}
