import {
  type BotGithubAskEvent,
  type BotGithubAskVia,
  type BotProvider,
  type BotTurnOrigin,
  botDefaultModel,
} from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import { composeRunPrompt } from '../../automations/domain/run-launch.policy';
import {
  GITHUB_MENTION_HANDLE,
  githubLogin,
  githubRepositoryName,
} from '../../github/domain/github-pull-event.policy';
import { channelReplyOf } from './bot-channel-turn.policy';
import { eventNote } from './bot-history.policy';
import { BotMessageEntity } from './bot-message.entity';
import { promptText } from './bot-prompt-text.policy';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * Asking a bot on GitHub, as rules: which GitHub events are asks, who may
 * ask, which bot is asked, the turn an ask queues, and the comment its answer
 * becomes. The owner asks with `@oppenheimer <bot>` in a comment or a review,
 * or with the label `bot:<bot>`; anyone else's ask is ignored. What was
 * written reaches the bot as outside data, and its last words go back as one
 * comment of Oppenheimer's App, which wakes nothing of ours (`loopGuard`).
 * Pure.
 */

/**
 * The turns not offered a tool that writes on GitHub in the owner's name or
 * asks another bot for an answer: a turn an ask on GitHub opened. Its answer
 * is the App's one comment; a comment of its own would be a second answer
 * under another name, and, being the owner's, one that names a bot would ask
 * that bot again with nothing to bound the chain. An answer another bot sends
 * back arrives as a turn of its own, which posts nothing on GitHub.
 */
export const NOT_ON_A_GITHUB_ASK = ['github'] as const satisfies readonly BotTurnOrigin[];

/** The label that asks a bot, before its name: `bot:Feynman`. */
export const GITHUB_ASK_LABEL_PREFIX = 'bot:';

/** GitHub refuses a comment past 65,536 characters; the answer is cut short of it. */
export const GITHUB_ANSWER_MAX = 60_000;

/** The stored GitHub event, as far as deciding whether it asks a bot reads it. */
export interface GithubAskCandidate {
  source: string;
  eventType: string;
  actorIsOwnApp: boolean;
  attributes: Record<string, unknown> | null;
}

/**
 * How an event asks, read from its metadata alone: a mention (which bot is
 * read from the comment once the asker is known to be the owner), or a
 * `bot:` label; null for anything else. Our App's own comments and labels
 * ask nothing, so an answer that names a bot never asks it again.
 */
export function githubAskVia(event: GithubAskCandidate): BotGithubAskVia | null {
  if (event.source !== 'github' || event.actorIsOwnApp) return null;
  if (event.eventType === 'mention') return 'mention';
  if (event.eventType === 'issue_labeled' && labelBotName(event.attributes?.label) !== null) {
    return 'label';
  }
  return null;
}

/**
 * Whether the GitHub login that asked is the owner's. Workspaces are
 * personal, so nobody else asks; with no login known for the owner, nobody
 * does.
 */
export function mayAskOnGithub(actorLogin: string | null, ownerLogin: string | null): boolean {
  const actor = githubLogin(actorLogin);
  return !!actor && !!ownerLogin && actor.toLowerCase() === ownerLogin.toLowerCase();
}

/** A bot's name as an ask compares it: no case, and spaces, `-` and `_` alike. */
function comparable(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

/** The bot a `bot:` label names, as written after the prefix; null for any other label. */
function labelBotName(label: unknown): string | null {
  if (typeof label !== 'string') return null;
  if (!label.toLowerCase().startsWith(GITHUB_ASK_LABEL_PREFIX)) return null;
  const name = label.slice(GITHUB_ASK_LABEL_PREFIX.length).trim();
  return name ? name : null;
}

/** The pattern a name is written by in a mention: its words, apart by spaces, `-` or `_`. */
function namePattern(name: string): string {
  return comparable(name)
    .split(' ')
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s_-]+');
}

/**
 * The bot an ask names among the owner's: for a label, the one whose name it
 * is; for a mention, the one whose name follows `@oppenheimer` in the
 * comment, the longest when two would ("Feynman 2" over "Feynman"). Null when
 * it names none of them.
 */
export function askedBot<T extends { name: string }>(
  bots: readonly T[],
  ask: { via: BotGithubAskVia; label?: unknown; body?: unknown },
): T | null {
  if (ask.via === 'label') {
    const wanted = labelBotName(ask.label);
    if (!wanted) return null;
    return bots.find((bot) => comparable(bot.name) === comparable(wanted)) ?? null;
  }
  if (typeof ask.body !== 'string') return null;
  const byLength = [...bots].sort((a, b) => comparable(b.name).length - comparable(a.name).length);
  for (const bot of byLength) {
    if (!comparable(bot.name)) continue;
    const mention = new RegExp(
      `(^|[^\\w/])@${GITHUB_MENTION_HANDLE}\\s+${namePattern(bot.name)}(?![\\w-])`,
      'i',
    );
    if (mention.test(ask.body)) return bot;
  }
  return null;
}

/** The key that makes one GitHub event one turn, however often it is delivered. */
export function githubAskSourceKey(inboundEventId: string): string {
  return `github:${inboundEventId}`;
}

/** An ask, as the turn it opens reads it: where it was made, and the event that made it. */
export interface GithubAsk {
  inboundEventId: string;
  event: BotGithubAskEvent;
  label: string | null;
  /** What was written, untrusted: the comment, or the issue's title and body. */
  context: Record<string, unknown>;
}

/**
 * The words that open the turn: where the ask was made and how to answer
 * it, then what was written, inside the untrusted-data envelope that no
 * comment can close (`composeRunPrompt`).
 */
export function githubAskText(ask: GithubAsk): string {
  const { event } = ask;
  const number = String(event.number);
  const target = event.isPullRequest ? 'pull request' : 'issue';
  const headline =
    event.via === 'label'
      ? promptText('github/wake-ask.headline-label', {
          actor: event.actorLogin,
          label: ask.label ?? '',
          target,
          number,
          repository: event.repository,
        })
      : promptText('github/wake-ask.headline-mention', {
          actor: event.actorLogin,
          target,
          number,
          repository: event.repository,
        });
  const instructions = [
    headline,
    promptText('github/wake-ask.read-it', {
      installationId: event.installationId,
      repoId: event.githubRepoId,
      number,
    }),
    promptText('github/wake-ask.answer'),
    promptText('github/wake-ask.closing'),
  ].join('\n\n');
  return (
    composeRunPrompt(instructions, {
      type: event.via === 'label' ? 'issue_labeled' : 'mention',
      source: 'github',
      subjectRef: event.githubRepoId,
      subjectName: event.repository,
      actorLogin: event.actorLogin,
      attributes: {},
      context: ask.context,
    }) ?? instructions
  );
}

/** What a turn an ask on GitHub opened is asked: the ask, as Oppenheimer's note. */
export function githubAskPrompt(content: string): string {
  return eventNote(content);
}

/** The bot an ask wakes, as its turn reads it. */
export interface GithubAskedBot {
  id: string;
  organizationId: string;
  provider: BotProvider;
  model: string | null;
  effort: SessionEffort | null;
}

/**
 * The turn an ask queues and the event line that opens it: in the
 * background lane, as the owner, in the bot's console chat, where the line
 * says it came from GitHub and links to it. Keyed so an event delivered twice
 * is one turn.
 */
export function githubAskTurn(
  bot: GithubAskedBot,
  ownerUserId: string,
  ask: GithubAsk,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    organizationId: bot.organizationId,
    botId: bot.id,
    requestedByUserId: ownerUserId,
    provider: bot.provider,
    model: bot.model ?? botDefaultModel(bot.provider).id,
    effort: bot.effort,
    origin: 'github',
    lane: 'background',
    sourceKey: githubAskSourceKey(ask.inboundEventId),
  });
  const opening = BotMessageEntity.createNew({
    organizationId: bot.organizationId,
    botId: bot.id,
    turnId: turn.id,
    role: 'event',
    content: githubAskText(ask),
    event: ask.event,
    steps: [],
    position: 0,
  });
  return { turn, opening };
}

/** The ask's event, from what GitHub said about it; null when it does not name a place to answer. */
export function githubAskEventOf(input: {
  via: BotGithubAskVia;
  installationId: string;
  githubRepoId: string;
  repository: string | null;
  attributes: Record<string, unknown> | null;
  url: unknown;
  actorLogin: string | null;
}): BotGithubAskEvent | null {
  const repository = githubRepositoryName(input.repository);
  const number = input.attributes?.number;
  const actorLogin = githubLogin(input.actorLogin);
  if (!repository || !actorLogin || typeof number !== 'number' || !Number.isInteger(number)) {
    return null;
  }
  const isPullRequest = input.attributes?.isPullRequest;
  return {
    kind: 'github_ask',
    via: input.via,
    installationId: input.installationId,
    githubRepoId: input.githubRepoId,
    repository,
    number,
    isPullRequest: typeof isPullRequest === 'boolean' ? isPullRequest : null,
    url: typeof input.url === 'string' && input.url.startsWith('https://') ? input.url : null,
    actorLogin,
  };
}

/**
 * The comment a turn's end posts: its last text, or what happened to it
 * (`channelReplyOf`), cut short of GitHub's limit.
 */
export function githubAnswerOf(
  turn: { status: string; error: string | null },
  texts: readonly string[],
): string {
  const answer = channelReplyOf(turn, texts);
  return answer.length > GITHUB_ANSWER_MAX ? `${answer.slice(0, GITHUB_ANSWER_MAX)}…` : answer;
}
