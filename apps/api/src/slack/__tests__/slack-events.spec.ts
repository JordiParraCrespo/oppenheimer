import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { DomainEvent } from '@oppenheimer/backend-ddd';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { SlackBotAppResolver } from '../application/slack-bot-app.resolver';
import { SLACK_NAMES_DEADLINE_MS, SlackLineResolver } from '../application/slack-line.resolver';
import { ConnectSlackCommand } from '../commands/connect-slack/connect-slack.command';
import { ConnectSlackCommandHandler } from '../commands/connect-slack/connect-slack.command-handler';
import { MarkSlackWorkingCommand } from '../commands/mark-slack-working/mark-slack-working.command';
import { MarkSlackWorkingCommandHandler } from '../commands/mark-slack-working/mark-slack-working.command-handler';
import { ReactOnSlackCommand } from '../commands/react-on-slack/react-on-slack.command';
import { ReactOnSlackCommandHandler } from '../commands/react-on-slack/react-on-slack.command-handler';
import { ReceiveSlackEventCommand } from '../commands/receive-slack-event/receive-slack-event.command';
import { ReceiveSlackEventCommandHandler } from '../commands/receive-slack-event/receive-slack-event.command-handler';
import { ReplyOnSlackCommand } from '../commands/reply-on-slack/reply-on-slack.command';
import { ReplyOnSlackCommandHandler } from '../commands/reply-on-slack/reply-on-slack.command-handler';
import type { SlackAccountRepositoryPort } from '../database/slack-account.repository.port';
import { SlackOwnerWroteDomainEvent } from '../domain/events/slack-owner-wrote.domain-event';
import { SlackErrors } from '../domain/slack.errors';
import { SlackAccountEntity } from '../domain/slack-account.entity';
import { slackReactionName } from '../domain/slack-reaction.policy';
import type { SlackSealerPort } from '../infrastructure/slack-sealer.port';
import type { SlackWebApiPort } from '../infrastructure/slack-web-api.port';
import { FindSlackImagesQuery } from '../queries/find-slack-images/find-slack-images.query';
import { FindSlackImagesQueryHandler } from '../queries/find-slack-images/find-slack-images.query-handler';

/**
 * What stands between Slack and a bot: only a request signed with the app's
 * own secret is read, only the owner's Slack user wakes the bot (the one a
 * `link` code recorded, sent in the app's DM), the answer goes in the thread
 * it was asked in, and a token Slack refuses shows on the app. A regression
 * here lets a stranger in a shared channel drive someone's bot, or a forged
 * request wake it.
 */

const ORG = '0b3e2a1c-1111-4c5d-8e6f-70819203b4c5';
const USER = '0b3e2a1c-2222-4c5d-8e6f-70819203b4c5';
const BOT = '0b3e2a1c-3333-4c5d-8e6f-70819203b4c5';
const SECRET = 'a'.repeat(32);
const OWNER = 'U0OWNER';
const APP_USER = 'U0JUNO';

/** Seals by prefixing, so a test can tell sealed from plain and open what it sealed. */
const sealer: SlackSealerPort = {
  isConfigured: () => true,
  seal: (plain) => Buffer.from(`sealed:${plain}`),
  open: (sealed) => sealed.toString().replace(/^sealed:/, ''),
};

function scopeOf(userId = USER): AccessScope {
  return { userId, organizationId: ORG, teamIds: [], grants: new Map(), bypass: false };
}

function app(owner: string | null = OWNER): SlackAccountEntity {
  const account = SlackAccountEntity.connect({
    organizationId: ORG,
    userId: USER,
    botId: BOT,
    identity: { teamId: 'T0ACME', teamName: 'Acme', botUserId: APP_USER, botName: 'juno' },
    sealedBotToken: sealer.seal('xoxb-token'),
    sealedSigningSecret: sealer.seal(SECRET),
    tokenHint: 'oken',
  });
  if (owner) {
    const { code } = account.openOwnerLink(new Date());
    account.claimOwner(code, owner, new Date());
  }
  return account;
}

function fakeAccounts(rows: SlackAccountEntity[]) {
  const published: DomainEvent[] = [];
  const repository: SlackAccountRepositoryPort = {
    findAllOwn: async (scope) => rows.filter((row) => row.userId === scope.userId),
    findOwnById: async (scope, id) => {
      const row = rows.find((item) => item.id === id && item.userId === scope.userId);
      return row ? Some(row) : None;
    },
    findOwnByBot: async (scope, botId) => {
      const row = rows.find((item) => item.botId === botId && item.userId === scope.userId);
      return row ? Some(row) : None;
    },
    findByBotForSystem: async (botId) => {
      const row = rows.find((item) => item.botId === botId);
      return row ? Some(row) : None;
    },
    findByIdForSystem: async (_organizationId, id) => {
      const row = rows.find((item) => item.id === id);
      return row ? Some(row) : None;
    },
    put: vi.fn(async (account: SlackAccountEntity) => {
      if (!rows.includes(account)) rows.push(account);
      return 'saved' as const;
    }),
    saveStatus: vi.fn(async () => {}),
    saveOwnerLink: vi.fn(async () => {}),
    saveOwner: vi.fn(async () => true),
    publish: vi.fn(async (events) => {
      published.push(...events);
    }),
    delete: vi.fn(async () => {}),
  };
  return { repository, published };
}

function fakeSlack(overrides: Partial<SlackWebApiPort> = {}): SlackWebApiPort {
  return {
    identify: vi.fn(async () => ({
      teamId: 'T0ACME',
      teamName: 'Acme',
      botUserId: APP_USER,
      botName: 'juno',
    })),
    post: vi.fn(async (_access, message) => ({ channel: message.channel, ts: '1.000001' })),
    userName: vi.fn(async (_access, userId: string) => (userId === 'U0MAYA' ? 'Maya' : null)),
    react: vi.fn(async () => {}),
    download: vi.fn(async () => Buffer.from('image')),
    ...overrides,
  };
}

function signed(payload: unknown, secret = SECRET, at = new Date()) {
  const body = Buffer.from(JSON.stringify(payload));
  const timestamp = String(Math.floor(at.getTime() / 1000));
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:`).update(body).digest('hex')}`;
  return new ReceiveSlackEventCommand({ botId: BOT, timestamp, signature, body });
}

function eventOf(event: Record<string, unknown>) {
  return { type: 'event_callback', team_id: 'T0ACME', event };
}

function receiver(rows: SlackAccountEntity[], slack = fakeSlack()) {
  const accounts = fakeAccounts(rows);
  const handler = new ReceiveSlackEventCommandHandler(
    accounts.repository,
    sealer,
    new SlackLineResolver(sealer, slack),
  );
  return { handler, ...accounts, slack };
}

describe('a request to a bot’s Slack events address', () => {
  it('answers Slack’s url_verification before the app is connected, so the app can be created', async () => {
    const { handler } = receiver([]);
    const command = new ReceiveSlackEventCommand({
      botId: BOT,
      timestamp: '',
      signature: '',
      body: Buffer.from(JSON.stringify({ type: 'url_verification', challenge: 'c4allenge' })),
    });
    await expect(handler.execute(command)).resolves.toEqual({ challenge: 'c4allenge' });
  });

  it('refuses an event signed with another secret, or signed too long ago, and wakes nothing', async () => {
    const { handler, published } = receiver([app()]);
    const mention = eventOf({
      type: 'app_mention',
      user: OWNER,
      text: 'hi',
      ts: '1700000000.000100',
      channel: 'C1',
    });
    const stale = new Date(Date.now() - 10 * 60_000);
    for (const command of [signed(mention, 'b'.repeat(32)), signed(mention, SECRET, stale)]) {
      await expect(handler.execute(command)).rejects.toMatchObject({
        code: SlackErrors.SIGNATURE_INVALID.code,
      });
    }
    expect(published).toEqual([]);
  });

  it('wakes the bot on its owner’s mention, answering in a new thread under it', async () => {
    const { handler, published } = receiver([app()]);
    await handler.execute(
      signed(
        eventOf({
          type: 'app_mention',
          user: OWNER,
          text: `<@${APP_USER}> what failed last night?`,
          ts: '1700000000.000100',
          channel: 'C1',
        }),
      ),
    );
    expect(published).toHaveLength(1);
    expect(published[0]).toBeInstanceOf(SlackOwnerWroteDomainEvent);
    expect(published[0]).toMatchObject({
      botId: BOT,
      userId: USER,
      command: 'message',
      text: 'what failed last night?',
      chatId: 'C1:1700000000.000100',
      position: '1700000000000100',
    });
  });

  it('keeps a reply in a thread in that thread’s conversation', async () => {
    const { handler, published } = receiver([app()]);
    await handler.execute(
      signed(
        eventOf({
          type: 'message',
          channel_type: 'im',
          user: OWNER,
          text: 'and today?',
          ts: '1700000500.000001',
          thread_ts: '1700000000.000100',
          channel: 'D1',
        }),
      ),
    );
    expect(published[0]).toMatchObject({ chatId: 'D1:1700000000.000100', text: 'and today?' });
  });

  // What breaks this: the bot reads "@U0MAYA" and cannot tell who the owner means.
  it('reads the people the owner mentions by name, and by id when Slack will not say', async () => {
    const { handler, published, slack } = receiver([app()]);
    await handler.execute(
      signed(
        eventOf({
          type: 'app_mention',
          user: OWNER,
          text: `<@${APP_USER}> ask <@U0MAYA> and <@U0GONE> about it`,
          ts: '1700000000.000100',
          channel: 'C1',
        }),
      ),
    );
    expect(published[0]).toMatchObject({ text: 'ask @Maya and @U0GONE about it' });
    expect(slack.userName).not.toHaveBeenCalledWith(expect.anything(), APP_USER);
  });

  // What breaks this: an app made before it asked for users:read stops answering mentions.
  it('still wakes the bot when Slack refuses to name anyone', async () => {
    const slack = fakeSlack({
      userName: vi.fn(async () => {
        throw new AppError(SlackErrors.TOKEN_REFUSED, { detail: 'missing_scope' });
      }),
    });
    const { handler, published } = receiver([app()], slack);
    await handler.execute(
      signed(
        eventOf({
          type: 'app_mention',
          user: OWNER,
          text: `<@${APP_USER}> ping <@U0MAYA>`,
          ts: '1700000000.000100',
          channel: 'C1',
        }),
      ),
    );
    expect(published[0]).toMatchObject({ text: 'ping @U0MAYA' });
  });

  // What breaks this: a message folded into a running turn keeps its eyes forever.
  it('puts no reaction on a message as it arrives: the turn does when it starts', async () => {
    const { handler, slack } = receiver([app()]);
    await handler.execute(
      signed(
        eventOf({
          type: 'app_mention',
          user: OWNER,
          text: `<@${APP_USER}> what failed?`,
          ts: '1700000000.000100',
          channel: 'C1',
        }),
      ),
    );
    expect(slack.react).not.toHaveBeenCalled();
  });

  // What breaks this: a screenshot the owner shares never reaches the bot,
  // or the app sends its token to a host Slack does not own.
  it('carries the images the owner shares from Slack’s file host only, and counts the rest', async () => {
    const { handler, published } = receiver([app()]);
    const file = (id: string, mimetype: string, url: string, size = 1_000) => ({
      id,
      name: `${id}.png`,
      mimetype,
      size,
      url_private_download: url,
    });
    await handler.execute(
      signed(
        eventOf({
          type: 'app_mention',
          subtype: 'file_share',
          user: OWNER,
          text: `<@${APP_USER}>`,
          ts: '1700000000.000100',
          channel: 'C1',
          files: [
            file('F1', 'image/png', 'https://files.slack.com/files-pri/T0-F1/a.png'),
            file('F2', 'image/png', 'https://files.slack.com.evil.example/a.png'),
            file('F3', 'application/pdf', 'https://files.slack.com/files-pri/T0-F3/a.pdf'),
            file('F4', 'image/jpeg', 'https://files.slack.com/files-pri/T0-F4/a.jpg', 9e9),
          ],
        }),
      ),
    );
    expect(published[0]).toMatchObject({
      command: 'message',
      text: '',
      images: [{ id: 'F1', name: 'F1.png', url: 'https://files.slack.com/files-pri/T0-F1/a.png' }],
      skippedFiles: 3,
    });
  });

  it('ignores anyone but the owner, in a channel or in the DM, and says nothing back', async () => {
    const slack = fakeSlack();
    const { handler, published } = receiver([app()], slack);
    await handler.execute(
      signed(
        eventOf({
          type: 'app_mention',
          user: 'U0ANA',
          text: 'deploy prod',
          ts: '1700000000.000200',
          channel: 'C1',
        }),
      ),
    );
    await handler.execute(
      signed(
        eventOf({
          type: 'message',
          channel_type: 'im',
          user: 'U0ANA',
          text: 'hi',
          ts: '1700000000.000300',
          channel: 'D2',
        }),
      ),
    );
    expect(published).toEqual([]);
    expect(slack.post).not.toHaveBeenCalled();
  });

  it('wakes nobody while no owner is linked, whoever writes', async () => {
    const { handler, published } = receiver([app(null)]);
    await handler.execute(
      signed(
        eventOf({
          type: 'app_mention',
          user: OWNER,
          text: 'hi',
          ts: '1700000000.000100',
          channel: 'C1',
        }),
      ),
    );
    expect(published).toEqual([]);
  });

  it('ignores the app’s own messages and other bots’, which would loop', async () => {
    const { handler, published } = receiver([app()]);
    await handler.execute(
      signed(
        eventOf({
          type: 'message',
          channel_type: 'im',
          user: APP_USER,
          text: 'Done.',
          ts: '1700000000.000400',
          channel: 'D1',
        }),
      ),
    );
    await handler.execute(
      signed(
        eventOf({
          type: 'message',
          channel_type: 'im',
          user: OWNER,
          bot_id: 'B1',
          text: 'echo',
          ts: '1700000000.000500',
          channel: 'D1',
        }),
      ),
    );
    expect(published).toEqual([]);
  });

  it('records the owner from the one-time code sent in the app’s DM, and only there', async () => {
    const account = app(null);
    const { code } = account.openOwnerLink(new Date());
    const slack = fakeSlack();
    const { handler, repository } = receiver([account], slack);

    await handler.execute(
      signed(
        eventOf({
          type: 'app_mention',
          user: 'U0ANA',
          text: `<@${APP_USER}> link ${code}`,
          ts: '1700000000.000600',
          channel: 'C1',
        }),
      ),
    );
    expect(account.ownerSlackUserId).toBeNull();

    await handler.execute(
      signed(
        eventOf({
          type: 'message',
          channel_type: 'im',
          user: OWNER,
          text: `link ${code}`,
          ts: '1700000000.000700',
          channel: 'D1',
        }),
      ),
    );
    expect(account.ownerSlackUserId).toBe(OWNER);
    expect(repository.saveOwner).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(slack.post).toHaveBeenCalledWith(
        { botToken: 'xoxb-token', bucket: `app:T0ACME:${APP_USER}` },
        expect.objectContaining({ channel: 'D1', threadTs: null }),
      ),
    );
  });
});

describe('a bot’s answer in Slack', () => {
  const reply = (text: string) =>
    new ReplyOnSlackCommand({
      organizationId: ORG,
      accountId: '',
      chatId: 'C1:1700000000.000100',
      text,
      botId: BOT,
    });

  it('goes in the thread it was asked in, in Slack’s own markdown', async () => {
    const account = app();
    const slack = fakeSlack();
    const handler = new ReplyOnSlackCommandHandler(
      fakeAccounts([account]).repository,
      new SlackBotAppResolver(fakeAccounts([account]).repository),
      new SlackLineResolver(sealer, slack),
    );
    const command = new ReplyOnSlackCommand({
      ...reply('**3 failed**, see [the run](https://ci.example/1)'),
      accountId: account.id,
    });
    await expect(handler.execute(command)).resolves.toBe(1);
    expect(slack.post).toHaveBeenCalledWith(expect.anything(), {
      channel: 'C1',
      threadTs: '1700000000.000100',
      text: '*3 failed*, see <https://ci.example/1|the run>',
    });
  });

  // What breaks this: a pasted token in an answer is read by everyone in the channel.
  it('sends a secret in the words as [redacted]', async () => {
    const account = app();
    const slack = fakeSlack();
    const handler = new ReplyOnSlackCommandHandler(
      fakeAccounts([account]).repository,
      new SlackBotAppResolver(fakeAccounts([account]).repository),
      new SlackLineResolver(sealer, slack),
    );
    const token = `ghp_${'a1B2c3D4'.repeat(5)}`;
    await handler.execute(
      new ReplyOnSlackCommand({ ...reply(`Use ${token} for the push`), accountId: account.id }),
    );
    const sent = vi.mocked(slack.post).mock.calls[0][1].text;
    expect(sent).not.toContain(token);
    expect(sent).toContain('[redacted]');
  });

  // What breaks this: a long answer arrives cut into pieces.
  it('sends a long answer whole, in one message', async () => {
    const account = app();
    const slack = fakeSlack();
    const handler = new ReplyOnSlackCommandHandler(
      fakeAccounts([account]).repository,
      new SlackBotAppResolver(fakeAccounts([account]).repository),
      new SlackLineResolver(sealer, slack),
    );
    const long = `${'word '.repeat(500).trim()}\n\n`.repeat(6).trim();
    await expect(
      handler.execute(new ReplyOnSlackCommand({ ...reply(long), accountId: account.id })),
    ).resolves.toBe(1);
  });

  it('marks the app revoked when Slack refuses its token, so its settings say why the bot went quiet', async () => {
    const account = app();
    const slack = fakeSlack({
      post: vi.fn(async () => {
        throw new AppError(SlackErrors.TOKEN_REFUSED, {
          detail: 'Slack refused the bot token: token_revoked',
        });
      }),
    });
    const accounts = fakeAccounts([account]);
    const handler = new ReplyOnSlackCommandHandler(
      accounts.repository,
      new SlackBotAppResolver(accounts.repository),
      new SlackLineResolver(sealer, slack),
    );
    await expect(
      handler.execute(new ReplyOnSlackCommand({ ...reply('hi'), accountId: account.id })),
    ).rejects.toThrow();
    expect(account.status).toBe('revoked');
    expect(accounts.repository.saveStatus).toHaveBeenCalledWith(account);
  });
});

describe('a bot’s turn starting on a Slack message', () => {
  const mark = (accountId: string, botId = BOT) =>
    new MarkSlackWorkingCommand({
      organizationId: ORG,
      accountId,
      chatId: 'C1:1700000000.000100',
      ts: '1700000500.000001',
      botId,
      working: true,
    });

  // What breaks this: the owner cannot tell from Slack that the bot is on it,
  // or another bot's app reacts for a turn that is not its own.
  it('marks that message as being worked on, while the app is still this bot’s', async () => {
    const account = app();
    const slack = fakeSlack();
    const handler = new MarkSlackWorkingCommandHandler(
      new SlackBotAppResolver(fakeAccounts([account]).repository),
      new SlackLineResolver(sealer, slack),
    );
    await handler.execute(mark(account.id, '0b3e2a1c-9999-4c5d-8e6f-70819203b4c5'));
    await handler.execute(mark(account.id));
    expect(slack.react).toHaveBeenCalledTimes(1);
    expect(slack.react).toHaveBeenCalledWith(
      expect.anything(),
      { channel: 'C1', ts: '1700000500.000001', name: 'eyes' },
      true,
    );
  });

  // What breaks this: Slack's three seconds pass while names are looked up, and Slack retries.
  it('stops waiting for names past the deadline, reading the late ones by id', async () => {
    vi.useFakeTimers();
    try {
      const slack = fakeSlack({ userName: vi.fn(() => new Promise<string | null>(() => {})) });
      const names = new SlackLineResolver(sealer, slack).namesOf(app(), ['U0MAYA']);
      await vi.advanceTimersByTimeAsync(SLACK_NAMES_DEADLINE_MS);
      await expect(names).resolves.toEqual(new Map());
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a bot’s reaction on Slack', () => {
  const react = (accountId: string, emoji: string | null, previous: string | null = null) =>
    new ReactOnSlackCommand({
      organizationId: ORG,
      accountId,
      chatId: 'C1:1700000000.000100',
      ts: '1700000500.000001',
      botId: BOT,
      emoji,
      previous,
    });

  function reacting(slack = fakeSlack()) {
    const account = app();
    const accounts = fakeAccounts([account]);
    const handler = new ReactOnSlackCommandHandler(
      accounts.repository,
      new SlackBotAppResolver(accounts.repository),
      new SlackLineResolver(sealer, slack),
    );
    return { account, accounts, handler, slack };
  }

  // What breaks this: Slack is sent the character (it takes only names), or
  // the bot's last reaction stays beside the new one.
  it('replaces the bot’s reaction by Slack’s names for them, on the owner’s message', async () => {
    const { account, handler, slack } = reacting();
    await expect(handler.execute(react(account.id, '❤️', '👍'))).resolves.toBe('reacted');
    const message = { channel: 'C1', ts: '1700000500.000001' };
    expect(vi.mocked(slack.react).mock.calls.map((call) => [call[1], call[2]])).toEqual([
      [{ ...message, name: '+1' }, false],
      [{ ...message, name: 'heart' }, true],
    ]);
  });

  // What breaks this: a reaction Slack has no name for sent anyway and
  // refused, with the bot told it reacted.
  it('refuses an emoji it has no Slack name for, before anything is sent', async () => {
    const { account, handler, slack } = reacting();
    await expect(handler.execute(react(account.id, '🦩'))).resolves.toBe('no_name');
    expect(slack.react).not.toHaveBeenCalled();
  });

  // What breaks this: the bot's 👀 taken off by the end of the turn, which
  // removes the app's working sign of the same name.
  it('keeps 👀 for the working sign', async () => {
    const { account, handler, slack } = reacting();
    await expect(handler.execute(react(account.id, '👀'))).resolves.toBe('working_sign');
    expect(slack.react).not.toHaveBeenCalled();
  });

  // What breaks this: a refused call drawn as a reaction the owner sees.
  it('answers not_sent when Slack refuses, and marks the app revoked on a refused token', async () => {
    const { account, accounts, handler } = reacting(
      fakeSlack({
        react: vi.fn(async () => {
          throw new AppError(SlackErrors.TOKEN_REFUSED, { detail: 'token_revoked' });
        }),
      }),
    );
    await expect(handler.execute(react(account.id, '👍'))).resolves.toBe('not_sent');
    expect(account.status).toBe('revoked');
    expect(accounts.repository.saveStatus).toHaveBeenCalledWith(account);
  });

  it('names skin tones as Slack does, with or without the presentation selector', () => {
    expect(slackReactionName('👍🏽')).toBe('+1::skin-tone-4');
    expect(slackReactionName('❤')).toBe('heart');
    expect(slackReactionName('✔️')).toBe('heavy_check_mark');
    expect(slackReactionName('🦩')).toBeNull();
  });
});

describe('the images the owner shared, fetched for the bot’s turn', () => {
  const images = [
    { id: 'F1', name: 'a.png', url: 'https://files.slack.com/files-pri/T0-F1/a.png' },
    { id: 'F2', name: 'b.png', url: 'https://files.slack.com/files-pri/T0-F2/b.png' },
  ];
  const query = (accountId: string, botId = BOT) =>
    new FindSlackImagesQuery({ organizationId: ORG, accountId, botId, images, maxBytes: 100 });

  // What breaks this: one image Slack will not hand over loses the owner's whole message,
  // or another bot's app fetches files for a turn that is not its own.
  it('answers the ones that came, as this bot’s app only', async () => {
    const account = app();
    const slack = fakeSlack({
      download: vi.fn(async (_access, url: string) => {
        if (url.includes('F2')) throw new AppError(SlackErrors.UNAVAILABLE);
        return Buffer.from('png');
      }),
    });
    const handler = new FindSlackImagesQueryHandler(
      new SlackBotAppResolver(fakeAccounts([account]).repository),
      new SlackLineResolver(sealer, slack),
    );
    await expect(handler.execute(query(account.id))).resolves.toEqual([
      { name: 'a.png', bytes: Buffer.from('png') },
    ]);
    expect(slack.download).toHaveBeenCalledWith(
      { botToken: 'xoxb-token', bucket: 'app:T0ACME:U0JUNO' },
      images[0].url,
      100,
    );
    vi.mocked(slack.download).mockClear();
    await expect(
      handler.execute(query(account.id, '0b3e2a1c-9999-4c5d-8e6f-70819203b4c5')),
    ).resolves.toEqual([]);
    expect(slack.download).not.toHaveBeenCalled();
  });
});

describe('connecting a bot’s Slack app', () => {
  it('stores nothing when Slack refuses the token, and seals what it keeps', async () => {
    const queryBus = { execute: vi.fn(async () => ({ id: BOT })) };
    const refusing = fakeSlack({
      identify: vi.fn(async () => {
        throw new AppError(SlackErrors.TOKEN_REFUSED);
      }),
    });
    const refused = fakeAccounts([]);
    const command = new ConnectSlackCommand({
      scope: scopeOf(),
      botId: BOT,
      botToken: 'xoxb-bad',
      signingSecret: SECRET,
    });
    await expect(
      new ConnectSlackCommandHandler(
        refused.repository,
        sealer,
        refusing,
        queryBus as never,
      ).execute(command),
    ).rejects.toMatchObject({ code: SlackErrors.TOKEN_REFUSED.code });
    expect(refused.repository.put).not.toHaveBeenCalled();

    const kept: SlackAccountEntity[] = [];
    await new ConnectSlackCommandHandler(
      fakeAccounts(kept).repository,
      sealer,
      fakeSlack(),
      queryBus as never,
    ).execute(
      new ConnectSlackCommand({
        scope: scopeOf(),
        botId: BOT,
        botToken: 'xoxb-good-token',
        signingSecret: SECRET,
      }),
    );
    expect(kept[0].sealedBotToken.toString()).toBe('sealed:xoxb-good-token');
    expect(kept[0].sealedSigningSecret.toString()).toBe(`sealed:${SECRET}`);
  });

  it('forgets the owner when the bot is given another Slack app, who has never met them', async () => {
    const account = app();
    const queryBus = { execute: vi.fn(async () => ({ id: BOT })) };
    const other = fakeSlack({
      identify: vi.fn(async () => ({
        teamId: 'T0OTHER',
        teamName: 'Other',
        botUserId: 'U0NEW',
        botName: 'juno',
      })),
    });
    await new ConnectSlackCommandHandler(
      fakeAccounts([account]).repository,
      sealer,
      other,
      queryBus as never,
    ).execute(
      new ConnectSlackCommand({
        scope: scopeOf(),
        botId: BOT,
        botToken: 'xoxb-other-token',
        signingSecret: SECRET,
      }),
    );
    expect(account.ownerSlackUserId).toBeNull();
    expect(account.teamId).toBe('T0OTHER');
  });
});
