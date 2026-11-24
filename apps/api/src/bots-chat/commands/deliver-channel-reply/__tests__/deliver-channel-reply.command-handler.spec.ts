import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { BotPermission } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { MarkSlackWorkingCommand } from '../../../../slack/commands/mark-slack-working/mark-slack-working.command';
import { ReactOnSlackCommand } from '../../../../slack/commands/react-on-slack/react-on-slack.command';
import { ReplyOnSlackCommand } from '../../../../slack/commands/reply-on-slack/reply-on-slack.command';
import { ReplyOnTelegramCommand } from '../../../../telegram/commands/reply-on-telegram/reply-on-telegram.command';
import type { SpokenAudio } from '../../../../voice/commands/synthesize-speech/synthesize-speech.command';
import { ReactOnWhatsappCommand } from '../../../../whatsapp/commands/react-on-whatsapp/react-on-whatsapp.command';
import { ReplyOnWhatsappCommand } from '../../../../whatsapp/commands/reply-on-whatsapp/reply-on-whatsapp.command';
import { BotChannelReplyResolver } from '../../../application/bot-channel-reply.resolver';
import type { BotModelAccessResolver } from '../../../application/bot-model-access.resolver';
import type { BotPermissionsResolver } from '../../../application/bot-permissions.resolver';
import { BotVoiceReplyResolver } from '../../../application/bot-voice-reply.resolver';
import type { BotApprovalRepositoryPort } from '../../../database/bot-approval.repository.port';
import type {
  BotChannelChat,
  BotConversationRepositoryPort,
} from '../../../database/bot-conversation.repository.port';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import type { ChannelTurnLine } from '../../../domain/bot-channel-turn.policy';
import { slackTurn } from '../../../domain/bot-slack-turn.policy';
import { telegramTurn } from '../../../domain/bot-telegram-turn.policy';
import { type BotPermissions, NO_PERMISSIONS } from '../../../domain/bot-tool-permission.policy';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import { whatsappSourceKey } from '../../../domain/bot-whatsapp-turn.policy';
import { DeliverChannelReplyCommand } from '../deliver-channel-reply.command';
import { DeliverChannelReplyCommandHandler } from '../deliver-channel-reply.command-handler';

/**
 * A channel turn's answer going back: once the turn ended, its last words go
 * to the chat its conversation is, as a reply to the message that opened it,
 * through the module of the chat's channel. A console turn, a turn still
 * running, a turn since gone and a chat whose account was disconnected send
 * nothing. A turn that sent as it went (the owner's own message) sends only
 * what it wrote after its last tool calls; the rest went out before them.
 * Whether the bot still answers there is the channel module's
 * (`ReplyOnTelegramCommandHandler`, `ReplyOnWhatsappCommandHandler`).
 */
const organizationId = randomUUID();
const userId = randomUUID();
const botId = randomUUID();
const telegramAccountId = randomUUID();
const whatsappAccountId = randomUUID();
const messageRowId = randomUUID();
const conversationId = randomUUID();
const SPOKEN = { mimetype: 'audio/ogg; codecs=opus' as const, seconds: 3 };
const engine = { provider: 'glm' as const, model: 'glm-5.3', effort: null };

function telegram(): BotTurnEntity {
  const { turn } = telegramTurn(
    { organizationId, botId, requestedByUserId: userId, ...engine },
    {
      conversationId,
      telegramAccountId,
      chatId: '123456789',
      messageId: '42',
      text: 'Is CI green?',
    },
  );
  return turn;
}

/** The turn wave 2's `whatsappTurn` makes: the owner lane, keyed by the stored row. */
function whatsapp(): BotTurnEntity {
  return BotTurnEntity.queue({
    organizationId,
    botId,
    requestedByUserId: userId,
    ...engine,
    conversationId,
    origin: 'whatsapp',
    lane: 'owner',
    sourceKey: whatsappSourceKey({ whatsappAccountId, messageRowId }),
  });
}

function consoleTurn(): BotTurnEntity {
  return BotTurnEntity.queue({ organizationId, botId, requestedByUserId: userId, ...engine });
}

function ended(turn: BotTurnEntity, status: 'completed' | 'failed' = 'completed'): BotTurnEntity {
  turn.start(new Date());
  turn.end(status, new Date(), status === 'failed' ? { error: 'The key was refused.' } : {});
  return turn;
}

/** A turn that said what it would do, called a tool, then answered. */
const LINES: ChannelTurnLine[] = [
  { role: 'assistant', content: 'Looking it up.' },
  { role: 'activity', content: '' },
  { role: 'assistant', content: 'Green since 10:12.' },
];

/** What a contact turn's voice reply reads: the owner's settings, the workspace's speech, the host. */
interface VoiceSetup {
  permissions?: BotPermissions;
  preset?: BotPermission;
  speaks?: boolean;
  /** What speaking the words does; three seconds of audio by default. */
  speak?: () => Promise<SpokenAudio>;
  /** What the WhatsApp module answers for a voice note: how many went. */
  voiceSent?: number;
}

function setup(
  turn: BotTurnEntity | null,
  chat: BotChannelChat | null = null,
  lines: ChannelTurnLine[] = LINES,
  pendingApprovalOf: string | null = null,
  voice: VoiceSetup = {},
) {
  const turns = {
    findForRun: vi.fn(async (id: string) => (turn && id === turn.id ? Some(turn) : None)),
  } satisfies Partial<BotTurnRepositoryPort>;
  const messages = {
    findTurnLines: vi.fn(async () => lines),
  } satisfies Partial<BotMessageRepositoryPort>;
  const conversations = {
    // Any conversation is the chat here, so only the turn's origin keeps a
    // console turn off the channels.
    findChannelChat: vi.fn(async () => chat),
  } satisfies Partial<BotConversationRepositoryPort>;
  const approvals = {
    findPending: vi.fn(async () =>
      pendingApprovalOf ? Some({ turnId: pendingApprovalOf }) : None,
    ),
  };
  const config = { get: vi.fn(() => 'https://console.example/') };
  const bus = {
    execute: vi.fn(async (command: { voice?: unknown }) =>
      command.voice ? (voice.voiceSent ?? 1) : 1,
    ),
  };
  const speech = {
    execute: vi.fn(
      voice.speak ?? (async (): Promise<SpokenAudio> => ({ ...SPOKEN, data: Buffer.from('ogg') })),
    ),
  };
  const voiceReplies = new BotVoiceReplyResolver(
    conversations as unknown as BotConversationRepositoryPort,
    {
      forBot: async () => voice.permissions ?? NO_PERMISSIONS,
    } as unknown as BotPermissionsResolver,
    {
      findBot: async () => ({ permission: voice.preset ?? 'auto' }),
    } as unknown as BotModelAccessResolver,
    { execute: async () => voice.speaks ?? true } as unknown as QueryBus,
    speech as unknown as CommandBus,
  );
  const handler = new DeliverChannelReplyCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    messages as unknown as BotMessageRepositoryPort,
    approvals as unknown as BotApprovalRepositoryPort,
    new BotChannelReplyResolver(
      conversations as unknown as BotConversationRepositoryPort,
      bus as unknown as CommandBus,
    ),
    config as unknown as ConfigService,
    voiceReplies,
  );
  const deliver = () =>
    handler.execute(new DeliverChannelReplyCommand({ turnId: turn?.id ?? randomUUID() }));
  return { bus, deliver, messages, speech };
}

const telegramChat: BotChannelChat = {
  kind: 'telegram',
  organizationId,
  botId,
  telegramAccountId,
  chatId: '123456789',
};
const slackAccountId = randomUUID();
const slackChat: BotChannelChat = {
  kind: 'slack',
  organizationId,
  botId,
  slackAccountId,
  chatId: 'C1:1700000000.000100',
};

function slack(): BotTurnEntity {
  const { turn } = slackTurn(
    { organizationId, botId, requestedByUserId: userId, ...engine },
    { conversationId, slackAccountId, channel: 'C1', ts: '1700000500.000001', text: 'and today?' },
  );
  return turn;
}

const whatsappChat: BotChannelChat = {
  kind: 'whatsapp',
  organizationId,
  botId,
  whatsappAccountId,
  chatId: '34600111222@s.whatsapp.net',
};

describe('DeliverChannelReplyCommandHandler', () => {
  // Breaks if the reply is not threaded under the message it answers, or goes
  // to another chat or Telegram bot than the conversation's.
  it('replies in the conversation’s Telegram chat, under the message that opened the turn, with its last words', async () => {
    const turn = ended(telegram());
    const { bus, deliver } = setup(turn, telegramChat);
    await deliver();

    expect(bus.execute).toHaveBeenCalledTimes(1);
    const [sent] = bus.execute.mock.calls[0] as unknown as [ReplyOnTelegramCommand];
    expect(sent).toBeInstanceOf(ReplyOnTelegramCommand);
    expect(sent).toMatchObject({
      organizationId,
      accountId: telegramAccountId,
      chatId: '123456789',
      replyToId: '42',
      text: 'Green since 10:12.',
      botId,
    });
  });

  // Breaks if the end sends again what the turn already sent before its
  // tool calls, or says "Done" over an answer the bot wrote last.
  it('sends only what the owner’s turn wrote after its last tool calls, or a closing line when it wrote nothing after them', async () => {
    const answered = setup(ended(whatsapp()), whatsappChat);
    await answered.deliver();
    expect(answered.bus.execute).toHaveBeenCalledTimes(1);
    expect(answered.bus.execute.mock.calls[0]?.[0]).toMatchObject({ text: 'Green since 10:12.' });

    const silent = setup(ended(whatsapp()), whatsappChat, LINES.slice(0, 2));
    await silent.deliver();
    expect(silent.bus.execute.mock.calls[0]?.[0]).toMatchObject({
      text: 'Done, with nothing to say here. The console has the details.',
    });
  });

  // Breaks if a turn that did not send as it went (an answer to the bot's
  // ask, queued in the chat's conversation) loses the words it wrote before
  // its last call: nothing sent them.
  it('answers with the last words of a channel turn that did not send as it went', async () => {
    const asked = BotTurnEntity.queue({
      organizationId,
      botId,
      requestedByUserId: userId,
      ...engine,
      conversationId,
      origin: 'telegram',
      lane: 'bots',
      chainId: randomUUID(),
    });
    const { bus, deliver } = setup(ended(asked), telegramChat, LINES.slice(0, 2));
    await deliver();
    expect(bus.execute.mock.calls[0]?.[0]).toMatchObject({ text: 'Looking it up.' });
  });

  // Breaks if a WhatsApp answer is sent through Telegram, to another number,
  // or without the stored message it quotes.
  it('replies in the conversation’s WhatsApp chat, quoting the stored message that opened the turn', async () => {
    const { bus, deliver } = setup(ended(whatsapp()), whatsappChat);
    await deliver();

    expect(bus.execute).toHaveBeenCalledTimes(1);
    const [sent] = bus.execute.mock.calls[0] as unknown as [ReplyOnWhatsappCommand];
    expect(sent).toBeInstanceOf(ReplyOnWhatsappCommand);
    expect(sent).toMatchObject({
      organizationId,
      accountId: whatsappAccountId,
      chatId: '34600111222@s.whatsapp.net',
      replyToRowId: messageRowId,
      text: 'Green since 10:12.',
      botId,
    });
  });

  // Breaks if the owner's message keeps the working reaction after its answer,
  // or the reaction comes off before the answer is in the thread.
  it('answers in the Slack thread, then takes the working reaction off the message', async () => {
    const { bus, deliver } = setup(ended(slack()), slackChat);
    await deliver();

    const [answer, off] = bus.execute.mock.calls.map(([command]) => command) as unknown as [
      ReplyOnSlackCommand,
      MarkSlackWorkingCommand,
    ];
    expect(answer).toBeInstanceOf(ReplyOnSlackCommand);
    expect(answer).toMatchObject({ chatId: 'C1:1700000000.000100', text: 'Green since 10:12.' });
    expect(off).toBeInstanceOf(MarkSlackWorkingCommand);
    expect(off).toMatchObject({ ts: '1700000500.000001', working: false });
  });

  // Breaks if an answer Slack refused leaves the eyes on for good.
  it('takes the working reaction off even when the answer did not go', async () => {
    const { bus, deliver } = setup(ended(slack()), slackChat);
    bus.execute.mockRejectedValueOnce(new Error('rate limited'));
    await expect(deliver()).rejects.toThrow('rate limited');
    expect(bus.execute.mock.calls[1][0]).toMatchObject({ working: false });
  });

  // Breaks if a turn whose lines could not be read leaves the eyes on for good.
  it('takes the working reaction off when the answer could not even be read', async () => {
    const { bus, deliver, messages } = setup(ended(slack()), slackChat);
    messages.findTurnLines.mockRejectedValueOnce(new Error('database down'));
    await expect(deliver()).rejects.toThrow('database down');
    expect(bus.execute).toHaveBeenCalledTimes(1);
    expect(bus.execute.mock.calls[0][0]).toMatchObject({ working: false });
  });

  // Breaks if a turn that stopped on a card leaves the chat with no way to it:
  // the card is answered only in the console.
  it('links to the bot in the console when the turn ended on its approval card, and not for another turn’s', async () => {
    const turn = ended(telegram());
    const waiting = setup(turn, telegramChat, LINES, turn.id);
    await waiting.deliver();
    const [sent] = waiting.bus.execute.mock.calls[0] as unknown as [ReplyOnTelegramCommand];
    expect(sent.text).toMatch(
      new RegExp(
        `Waiting for your approval in Oppenheimer: https://console\\.example/bots/${botId}$`,
      ),
    );

    const other = setup(turn, telegramChat, LINES, randomUUID());
    await other.deliver();
    const [plain] = other.bus.execute.mock.calls[0] as unknown as [ReplyOnTelegramCommand];
    expect(plain.text).not.toMatch(/approval/);
  });

  it('tells the owner a failed turn failed, with why', async () => {
    const { bus, deliver } = setup(ended(telegram(), 'failed'), telegramChat);
    await deliver();
    const [sent] = bus.execute.mock.calls[0] as unknown as [ReplyOnTelegramCommand];
    expect(sent.text).toBe('I could not finish that: The key was refused.');
  });

  // Breaks if a console turn's answer leaks to a channel, a reply goes out
  // before the turn ends, or one goes to an account disconnected while the
  // turn ran.
  it('sends nothing for a console turn, a turn still running, a missing turn, or a disconnected chat', async () => {
    const running = telegram();
    running.start(new Date());
    for (const [turn, found] of [
      [ended(consoleTurn()), telegramChat],
      [ended(consoleTurn()), whatsappChat],
      [running, telegramChat],
      [null, telegramChat],
      [ended(telegram()), null],
      [ended(whatsapp()), null],
    ] as const) {
      const { bus, deliver } = setup(turn, found);
      await deliver();
      expect(bus.execute).not.toHaveBeenCalled();
    }
  });

  // What breaks this: a group reading why a turn failed (the owner's key,
  // a provider's or the database's words), or "the console has the
  // details" sent to someone who has no console.
  it('tells a contact a failed turn failed without why, and sends nothing when the bot said nothing', async () => {
    const contactTurn = () =>
      BotTurnEntity.queue({
        organizationId,
        botId,
        requestedByUserId: userId,
        ...engine,
        conversationId,
        origin: 'whatsapp',
        lane: 'owner',
        sourceKey: whatsappSourceKey({ whatsappAccountId, messageRowId }),
        contact: 'direct',
      });
    const failed = setup(ended(contactTurn(), 'failed'), whatsappChat);
    await failed.deliver();
    expect(failed.bus.execute.mock.calls[0]?.[0]).toMatchObject({
      text: 'Sorry, I can’t answer that right now.',
    });

    const silent = setup(ended(contactTurn()), whatsappChat, []);
    await silent.deliver();
    expect(silent.bus.execute).not.toHaveBeenCalled();
  });

  // Breaks if the working reaction goes on another message than the turn's own,
  // or a Telegram turn is sent a Slack command.
  it('marks the Slack message a turn is on as being worked on, and nothing on another channel', async () => {
    const bus = { execute: vi.fn(async () => undefined) };
    const resolverFor = (chat: BotChannelChat) =>
      new BotChannelReplyResolver(
        { findChannelChat: vi.fn(async () => chat) } as unknown as BotConversationRepositoryPort,
        bus as unknown as CommandBus,
      );
    await resolverFor(slackChat).started(slack());
    const [sent] = bus.execute.mock.calls[0] as unknown as [MarkSlackWorkingCommand];
    expect(sent).toBeInstanceOf(MarkSlackWorkingCommand);
    expect(sent).toMatchObject({
      accountId: slackAccountId,
      chatId: 'C1:1700000000.000100',
      ts: '1700000500.000001',
      botId,
      working: true,
    });
    await resolverFor(telegramChat).started(telegram());
    expect(bus.execute).toHaveBeenCalledTimes(1);
  });
  describe('a contact’s reply in a group that may hear a voice note', () => {
    const groupChat: BotChannelChat = {
      kind: 'whatsapp',
      organizationId,
      botId,
      whatsappAccountId,
      chatId: '120363000000000001@g.us',
    };
    const groupTurn = () =>
      ended(
        BotTurnEntity.queue({
          organizationId,
          botId,
          requestedByUserId: userId,
          ...engine,
          conversationId,
          origin: 'whatsapp',
          lane: 'owner',
          sourceKey: whatsappSourceKey({ whatsappAccountId, messageRowId }),
          contact: 'group',
        }),
      );
    const said = (content: string): ChannelTurnLine[] => [{ role: 'assistant', content }];
    /** The owner's standing yes for voice notes, on one number's chat. */
    const voiceGrant = (accountId: string, chatId: string): BotPermissions => ({
      decisions: new Map(),
      grants: [
        {
          tool: 'send_whatsapp_voice_note',
          subject: { kind: 'whatsapp_chat', key: `${accountId}:${chatId}`, label: 'Test group' },
        },
      ],
      rules: [],
    });
    const allowed = { permissions: voiceGrant(whatsappAccountId, groupChat.chatId) };
    const sent = (bus: { execute: { mock: { calls: unknown[][] } } }) =>
      bus.execute.mock.calls.map(([command]) => command as ReplyOnWhatsappCommand);

    // Breaks if the voice preference spreads to every reply: a greeting the
    // bot answered in words stays words, even where voice is allowed.
    it('sends an ordinary greeting answered in words as text, and speaks nothing', async () => {
      const { bus, deliver, speech } = setup(
        groupTurn(),
        groupChat,
        said('Hi all! 👋'),
        null,
        allowed,
      );
      await deliver();
      expect(speech.execute).not.toHaveBeenCalled();
      expect(sent(bus)).toHaveLength(1);
      expect(sent(bus)[0]).toBeInstanceOf(ReplyOnWhatsappCommand);
      expect(sent(bus)[0]).toMatchObject({ text: 'Hi all! 👋', voice: undefined });
    });

    // The reported bug: a group whose bot is meant to answer by voice got
    // text, because a contact's turn had no way to be heard.
    it('speaks a greeting the bot marked to be heard, once, and sends no text beside it', async () => {
      const { bus, deliver, speech } = setup(
        groupTurn(),
        groupChat,
        said('[voice] Hi everyone, good to hear from you.'),
        null,
        allowed,
      );
      await deliver();
      expect(speech.execute).toHaveBeenCalledTimes(1);
      expect(speech.execute.mock.calls[0]?.[0]).toMatchObject({
        organizationId,
        text: 'Hi everyone, good to hear from you.',
      });
      expect(sent(bus)).toHaveLength(1);
      expect(sent(bus)[0]).toMatchObject({
        accountId: whatsappAccountId,
        chatId: groupChat.chatId,
        replyToRowId: messageRowId,
        text: 'Hi everyone, good to hear from you.',
        voice: { seconds: 3 },
      });
    });

    // Breaks if a contact's turn can speak for the owner where the voice
    // tool would have asked: no grant, a grant on another chat or number,
    // the tool switched off, or a workspace that cannot speak.
    it.each([
      ['no voice grant at all', { permissions: NO_PERMISSIONS }],
      ['a grant on another chat', { permissions: voiceGrant(whatsappAccountId, '1203639@g.us') }],
      [
        'a grant on another number',
        { permissions: voiceGrant(randomUUID(), '120363000000000001@g.us') },
      ],
      [
        'the voice tool switched off',
        {
          permissions: {
            ...voiceGrant(whatsappAccountId, '120363000000000001@g.us'),
            decisions: new Map([['send_whatsapp_voice_note', 'off' as const]]),
          },
          preset: 'full' as const,
        },
      ],
      ['a workspace with no speech', { ...allowed, speaks: false }],
      [
        'Full access and an ask rule the voice tool would be read against',
        {
          preset: 'full' as const,
          permissions: {
            ...NO_PERMISSIONS,
            rules: [{ id: 'r-1', effect: 'ask' as const, text: 'Ask me before any voice note' }],
          },
        },
      ],
    ])('sends a marked reply as text, mark off, with %s', async (_case, voice: VoiceSetup) => {
      const { bus, deliver, speech } = setup(
        groupTurn(),
        groupChat,
        said('[voice] Hi everyone.'),
        null,
        voice,
      );
      await deliver();
      expect(speech.execute).not.toHaveBeenCalled();
      expect(sent(bus)).toHaveLength(1);
      expect(sent(bus)[0]).toMatchObject({ text: 'Hi everyone.', voice: undefined });
    });

    // Breaks if Full access, under which the voice tool runs in any chat
    // without asking, is not honoured the same way for a reply.
    it('speaks a marked reply under Full access with no grant for the chat', async () => {
      const { bus, deliver } = setup(groupTurn(), groupChat, said('[voice] Hello.'), null, {
        preset: 'full',
      });
      await deliver();
      expect(sent(bus)).toEqual([expect.objectContaining({ voice: expect.anything() })]);
    });

    // Breaks if what is better read (a link, a list) is spoken, or a reply
    // too long for one note is cut: those go as the words.
    it.each([
      ['a link', '[voice] The notes are at https://example.test/notes'],
      ['a list', '[voice] Bring:\n- water\n- a hat'],
      ['too many words for one note', `[voice] ${'la '.repeat(400)}`],
    ])('sends %s as text even when marked', async (_case, reply) => {
      const { bus, deliver, speech } = setup(groupTurn(), groupChat, said(reply), null, allowed);
      await deliver();
      expect(speech.execute).not.toHaveBeenCalled();
      expect(sent(bus)).toHaveLength(1);
      expect(sent(bus)[0]?.text.startsWith('[voice]')).toBe(false);
      expect(sent(bus)[0]?.voice).toBeUndefined();
    });

    // Breaks if a failure to speak or to send the note leaves the group
    // with no answer, or if a note that went is followed by the same words.
    it('falls back to the words once when speaking or sending the note fails', async () => {
      const unspoken = setup(groupTurn(), groupChat, said('[voice] Hello.'), null, {
        ...allowed,
        speak: async () => {
          throw new Error('speech provider down');
        },
      });
      await unspoken.deliver();
      expect(sent(unspoken.bus)).toEqual([
        expect.objectContaining({ text: 'Hello.', voice: undefined }),
      ]);

      const unsent = setup(groupTurn(), groupChat, said('[voice] Hello.'), null, {
        ...allowed,
        voiceSent: 0,
      });
      await unsent.deliver();
      expect(sent(unsent.bus)).toHaveLength(2);
      expect(sent(unsent.bus)[0]?.voice).toBeDefined();
      expect(sent(unsent.bus)[1]).toMatchObject({ text: 'Hello.', voice: undefined });
    });

    // Breaks if the owner's own chat changes: the mark means nothing there,
    // where the bot has the voice tool itself.
    it('leaves the owner’s own turns alone', async () => {
      const { bus, deliver, speech } = setup(
        ended(whatsapp()),
        whatsappChat,
        said('[voice] Hello.'),
        null,
        { preset: 'full' },
      );
      await deliver();
      expect(speech.execute).not.toHaveBeenCalled();
      expect(sent(bus)[0]).toMatchObject({ text: '[voice] Hello.', voice: undefined });
    });
  });
});

describe('BotChannelReplyResolver.react', () => {
  function resolverFor(chat: BotChannelChat | null, answer: unknown = 'reacted') {
    const bus = { execute: vi.fn(async () => answer) };
    const resolver = new BotChannelReplyResolver(
      { findChannelChat: vi.fn(async () => chat) } as unknown as BotConversationRepositoryPort,
      bus as unknown as CommandBus,
    );
    return { bus, resolver };
  }

  // Breaks if the reaction lands on another message than the one the turn
  // opened on, or goes through another channel than the conversation's.
  it('reacts on the Slack message or the stored WhatsApp row the turn opened on', async () => {
    const onSlack = resolverFor(slackChat);
    await expect(onSlack.resolver.react(slack(), '🎉', '👍')).resolves.toBe('reacted');
    const [toSlack] = onSlack.bus.execute.mock.calls[0] as unknown as [ReactOnSlackCommand];
    expect(toSlack).toBeInstanceOf(ReactOnSlackCommand);
    expect(toSlack).toMatchObject({
      accountId: slackAccountId,
      chatId: 'C1:1700000000.000100',
      ts: '1700000500.000001',
      emoji: '🎉',
      previous: '👍',
    });

    const onWhatsapp = resolverFor(whatsappChat, true);
    await expect(onWhatsapp.resolver.react(whatsapp(), null, '👍')).resolves.toBe('reacted');
    const [toWhatsapp] = onWhatsapp.bus.execute.mock.calls[0] as unknown as [
      ReactOnWhatsappCommand,
    ];
    expect(toWhatsapp).toBeInstanceOf(ReactOnWhatsappCommand);
    expect(toWhatsapp).toMatchObject({ accountId: whatsappAccountId, messageRowId, emoji: '' });
  });

  // Breaks if a reaction the channel refused, or one it cannot carry, reads as sent.
  it('says why nothing went: not sent, no key, a channel without reactions, no channel', async () => {
    await expect(
      resolverFor(whatsappChat, false).resolver.react(whatsapp(), '👍', null),
    ).resolves.toBe('not_sent');
    const keyless = resolverFor(slackChat);
    await expect(
      keyless.resolver.react({ ...slack(), sourceKey: null } as BotTurnEntity, '👍', null),
    ).resolves.toBe('unreachable');
    expect(keyless.bus.execute).not.toHaveBeenCalled();
    await expect(resolverFor(telegramChat).resolver.react(telegram(), '👍', null)).resolves.toBe(
      'unsupported',
    );
    await expect(resolverFor(null).resolver.react(slack(), '👍', null)).resolves.toBe('no_channel');
  });
});
