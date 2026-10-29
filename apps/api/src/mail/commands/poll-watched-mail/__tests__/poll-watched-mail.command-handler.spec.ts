import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { WatchedSubject } from '../../../../automations/domain/automation-read.types';
import { ReceiveInboundDeliveryCommand } from '../../../../inbound-events/commands/receive-inbound-delivery/receive-inbound-delivery.command';
import type { GmailCallResolver } from '../../../application/gmail-call.resolver';
import { MailWatchResolver } from '../../../application/mail-watch.resolver';
import type { GmailConnectionRepositoryPort } from '../../../database/gmail-connection.repository.port';
import { GmailConnectionEntity } from '../../../domain/gmail-connection.entity';
import type {
  GmailMessageSummary,
  GmailProviderPort,
} from '../../../infrastructure/gmail-provider.port';
import { PollWatchedMailCommand } from '../poll-watched-mail.command';
import { PollWatchedMailCommandHandler } from '../poll-watched-mail.command-handler';

/**
 * The poll that wakes mail routines (`product/next-steps/mail.md` §5): only
 * accounts a live routine watches are read, an account starts from now, a
 * trigger's query decides which new messages reach the hub, the mark moves
 * on, and one account failing leaves the others read. What breaks this: a
 * poll that reads every connected mailbox, delivers mail that matched no
 * trigger, replays mail from before a routine watched, or reads an account
 * from another workspace's trigger.
 */
const account = (overrides: { historyId?: string | null; organizationId?: string } = {}) =>
  GmailConnectionEntity.connect({
    organizationId: overrides.organizationId ?? 'org-1',
    userId: 'owner-1',
    googleSubject: 'sub-1',
    accountEmail: 'ana@gmail.test',
    label: 'Personal',
    refreshTokenSealed: Buffer.from('sealed'),
    scopes: [],
    historyId: overrides.historyId === undefined ? '100' : overrides.historyId,
  });

const summary = (id: string): GmailMessageSummary => ({
  id,
  threadId: `t-${id}`,
  from: 'Bo <bo@client.test>',
  to: 'ana@gmail.test',
  cc: '',
  subject: `Subject ${id}`,
  date: new Date('2026-10-29T12:00:00Z'),
  snippet: `Snippet ${id}`,
  labelIds: ['INBOX'],
  attachments: [],
});

function setup(
  connections: GmailConnectionEntity[],
  watched: (connections: GmailConnectionEntity[]) => WatchedSubject[],
) {
  const provider = {
    currentHistoryId: vi.fn(async () => '500'),
    newMessages: vi.fn<GmailProviderPort['newMessages']>(async () => ({
      messageIds: ['m1', 'm2'],
      historyId: '200',
    })),
    matchingIds: vi.fn<GmailProviderPort['matchingIds']>(async (_grant, _query, among) =>
      among.filter((id) => id === 'm2'),
    ),
    readSummaries: vi.fn<GmailProviderPort['readSummaries']>(async (_grant, ids) =>
      ids.map(summary),
    ),
  };
  const gmail = {
    call: vi.fn(
      async (_connection: GmailConnectionEntity, run: (p: unknown, g: unknown) => unknown) =>
        run(provider, { accessToken: 'token' }),
    ),
  } as unknown as GmailCallResolver;
  const repository: Pick<GmailConnectionRepositoryPort, 'findManyForSystem' | 'markHistory'> = {
    findManyForSystem: vi.fn(async (ids: readonly string[]) =>
      connections.filter((connection) => ids.includes(connection.id)),
    ),
    markHistory: vi.fn(async () => true),
  };
  const queryBus = { execute: vi.fn(async () => watched(connections)) } as unknown as QueryBus;
  const commands = vi.fn(async () => undefined);
  const handler = new PollWatchedMailCommandHandler(
    queryBus,
    { execute: commands } as unknown as CommandBus,
    new MailWatchResolver(gmail),
    repository as GmailConnectionRepositoryPort,
  );
  const poll = () => handler.execute(new PollWatchedMailCommand({ now: new Date() }));
  return { poll, provider, repository, commands, gmail };
}

const watching =
  (filters: (string | null)[]) =>
  ([first]: GmailConnectionEntity[]): WatchedSubject[] => [
    { organizationId: 'org-1', subjectRef: first.id, filters },
  ];

describe('PollWatchedMailCommandHandler', () => {
  it('reads nothing when no live routine watches an account', async () => {
    const { poll, provider, repository, commands } = setup([account()], () => []);

    expect(await poll()).toBe(0);
    expect(repository.findManyForSystem).not.toHaveBeenCalled();
    expect(provider.newMessages).not.toHaveBeenCalled();
    expect(commands).not.toHaveBeenCalled();
  });

  it('starts a newly watched account from now, delivering none of its older mail', async () => {
    const connection = account({ historyId: null });
    const { poll, provider, repository, commands } = setup([connection], watching([null]));

    expect(await poll()).toBe(0);
    expect(repository.markHistory).toHaveBeenCalledWith(connection, '500');
    expect(provider.newMessages).not.toHaveBeenCalled();
    expect(commands).not.toHaveBeenCalled();
  });

  it('hands the hub only the messages a watched query matched, and moves the mark on', async () => {
    const connection = account();
    const { poll, provider, repository, commands } = setup(
      [connection],
      watching(['from:billing@client.test']),
    );

    expect(await poll()).toBe(1);
    expect(provider.matchingIds).toHaveBeenCalledWith(
      expect.anything(),
      '(from:billing@client.test) newer_than:2d',
      ['m1', 'm2'],
    );
    expect(provider.readSummaries).toHaveBeenCalledWith(expect.anything(), ['m2']);
    const [delivery] = commands.mock.calls[0] as unknown as [ReceiveInboundDeliveryCommand];
    expect(delivery).toBeInstanceOf(ReceiveInboundDeliveryCommand);
    expect(delivery).toMatchObject({
      source: 'gmail',
      deliveryId: `${connection.id}:100:200`,
      payload: {
        connectionId: connection.id,
        messages: [expect.objectContaining({ id: 'm2', matched: ['from:billing@client.test'] })],
      },
    });
    expect(repository.markHistory).toHaveBeenCalledWith(connection, '200');
  });

  it('takes every new message when a routine watches for any mail, without searching', async () => {
    const { poll, provider } = setup([account()], watching([null]));

    expect(await poll()).toBe(2);
    expect(provider.matchingIds).not.toHaveBeenCalled();
    expect(provider.readSummaries).toHaveBeenCalledWith(expect.anything(), ['m1', 'm2']);
  });

  it('starts again from now when Gmail no longer keeps the stored mark', async () => {
    const connection = account();
    const { poll, provider, repository, commands } = setup([connection], watching([null]));
    provider.newMessages.mockResolvedValueOnce(null);

    expect(await poll()).toBe(0);
    expect(repository.markHistory).toHaveBeenCalledWith(connection, '500');
    expect(commands).not.toHaveBeenCalled();
  });

  it("never reads an account for another workspace's trigger", async () => {
    const connection = account({ organizationId: 'org-2' });
    const { poll, gmail } = setup([connection], watching([null]));

    expect(await poll()).toBe(0);
    expect(gmail.call).not.toHaveBeenCalled();
  });

  it('reads the other accounts when one fails', async () => {
    const broken = account();
    const working = account();
    const { poll, provider, commands } = setup([broken, working], (connections) =>
      connections.map((connection) => ({
        organizationId: 'org-1',
        subjectRef: connection.id,
        filters: [null],
      })),
    );
    provider.newMessages.mockRejectedValueOnce(new Error('Gmail is down'));

    expect(await poll()).toBe(2);
    expect(commands).toHaveBeenCalledTimes(1);
  });
});
