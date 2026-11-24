import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { BotPermission } from '@oppenheimer/shared';
import {
  type SpokenAudio,
  SynthesizeSpeechCommand,
} from '../../voice/commands/synthesize-speech/synthesize-speech.command';
import { SPEECH_TEXT_MAX_CHARS } from '../../voice/domain/voice-synthesis.policy';
import { FindSpeechSynthesisQuery } from '../../voice/queries/find-speech-synthesis/find-speech-synthesis.query';
import { BOT_CONVERSATION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotConversationRepositoryPort } from '../database/bot-conversation.repository.port';
import type { BotPermissions } from '../domain/bot-tool-permission.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { voiceReplyAllowed, voiceReplyChoice } from '../domain/bot-voice-reply.policy';
import { BotModelAccessResolver } from './bot-model-access.resolver';
import { BotPermissionsResolver } from './bot-permissions.resolver';

type VoiceTurn = Pick<
  BotTurnEntity,
  'organizationId' | 'conversationId' | 'botId' | 'origin' | 'contact'
>;

/** A contact turn's reply as it goes: its words, and the voice note they are spoken as, if any. */
export interface VoiceReply {
  text: string;
  voice: { audio: Buffer; seconds: number } | null;
}

/**
 * A contact's turn on WhatsApp answering as a voice note. Such a turn has no
 * tools, so the bot cannot call `send_whatsapp_voice_note`; where the owner
 * lets that tool run in the chat without asking and the workspace can speak,
 * the turn is told it may mark its reply to be heard (`maxChars`), and its
 * reply is spoken when it ends (`prepare`), the permission and the speech
 * read again then. Everything else, and any failure to speak, is text.
 */
@Injectable()
export class BotVoiceReplyResolver {
  private readonly logger = new Logger(BotVoiceReplyResolver.name);

  constructor(
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
    private readonly permissions: BotPermissionsResolver,
    private readonly access: BotModelAccessResolver,
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  /**
   * The most characters this turn's reply may speak, or null when it answers
   * in text: any turn but a contact's on WhatsApp, a chat the voice tool may
   * not reach without asking, or a workspace with nothing to speak with.
   */
  async maxChars(
    turn: VoiceTurn,
    known?: { preset: BotPermission; permissions: BotPermissions },
  ): Promise<number | null> {
    if (turn.origin !== 'whatsapp' || turn.contact === null) return null;
    const chat = await this.conversations.findChannelChat(turn.organizationId, turn.conversationId);
    if (chat?.kind !== 'whatsapp') return null;
    const settings = known ?? (await this.settingsOf(turn));
    if (!settings || !voiceReplyAllowed(settings.permissions, settings.preset, chat)) return null;
    const speaks = await this.queries.execute<FindSpeechSynthesisQuery, boolean>(
      new FindSpeechSynthesisQuery(turn.organizationId),
    );
    return speaks ? SPEECH_TEXT_MAX_CHARS : null;
  }

  /**
   * The reply a contact turn ended with, as it goes: spoken when the bot
   * marked it and `maxChars` still allows it, else its words, the mark off.
   * A speech failure is logged and leaves the words, so the chat hears the
   * answer once either way.
   */
  async prepare(turn: VoiceTurn, reply: string): Promise<VoiceReply> {
    const maxChars = await this.maxChars(turn);
    const choice = voiceReplyChoice(reply, maxChars !== null, maxChars ?? 0);
    if (!choice.spoken) return { text: choice.text, voice: null };
    try {
      const spoken = await this.commands.execute<SynthesizeSpeechCommand, SpokenAudio>(
        new SynthesizeSpeechCommand({ organizationId: turn.organizationId, text: choice.text }),
      );
      return { text: choice.text, voice: { audio: spoken.data, seconds: spoken.seconds } };
    } catch (error) {
      this.logger.warn({
        message: 'A voice reply could not be spoken; it goes as text',
        botId: turn.botId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { text: choice.text, voice: null };
    }
  }

  private async settingsOf(
    turn: VoiceTurn,
  ): Promise<{ preset: BotPermission; permissions: BotPermissions } | null> {
    const bot = await this.access.findBot(turn.organizationId, turn.botId);
    if (!bot) return null;
    const permissions = await this.permissions.forBot(turn.organizationId, turn.botId);
    return { preset: bot.permission, permissions };
  }
}
