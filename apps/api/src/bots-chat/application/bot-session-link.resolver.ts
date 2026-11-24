import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sessionLink } from '../domain/bot-session-link.policy';
import { type BotToolCallContext, inChannel } from './bot-tool.factory';

/**
 * A session's console link, for every tool that names a session: the one
 * reader of `app.frontendUrl` for it, and the one place that decides a
 * channel turn is owed the link in words because its chat draws no button.
 */
@Injectable()
export class BotSessionLinkResolver {
  constructor(private readonly config: ConfigService) {}

  /** The session's console page. */
  link(sessionId: string): string {
    return sessionLink(this.config.getOrThrow<string>('app.frontendUrl'), sessionId);
  }

  /** The link the bot must write itself, on a channel turn; null where the console draws its button. */
  forTurn(context: BotToolCallContext, sessionId: string): string | null {
    return inChannel(context) ? this.link(sessionId) : null;
  }
}
