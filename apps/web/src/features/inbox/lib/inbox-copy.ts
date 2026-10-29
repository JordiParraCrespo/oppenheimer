import type { InboxItem } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';

/** What a row and the message say about an item, in the reader's language. */
export interface InboxCopy {
  /** Who it is from: the session, the bot, the pull request's author, the automation. */
  sender: string;
  /** The row's subject. */
  short: string;
  /** Where it comes from, without its projects or its sender. */
  source: string;
  /** The card's question. */
  title: string;
  /** The card's sentence under it. */
  body: string;
}

function sessionCopy(item: Extract<InboxItem, { kind: 'session' }>, t: TFunction): InboxCopy {
  const { session } = item;
  const name = session.name;
  const source = session.scopeLabel ?? t('inbox.from.session');
  if (session.lifecycle === 'failed') {
    return {
      sender: name,
      short: t('inbox.session.failedShort', { name }),
      source,
      title: t('inbox.session.failedTitle', { name }),
      body: t('inbox.session.failedBody'),
    };
  }
  if (session.lifecycle === 'starting') {
    return {
      sender: name,
      short: t('inbox.session.startingShort', { name }),
      source,
      title: t('inbox.session.startingTitle', { name }),
      body: t('inbox.session.startingBody'),
    };
  }
  const { decision } = session;
  if (decision?.kind === 'permission') {
    return {
      sender: name,
      short: t('inbox.session.blockedShort', { name }),
      source,
      title: decision.title,
      body: t('inbox.session.permissionBody'),
    };
  }
  if (decision?.kind === 'question') {
    return {
      sender: name,
      short: t('inbox.session.blockedShort', { name }),
      source,
      title: t('inbox.session.questionTitle', { name, count: decision.questions.length }),
      body: t('inbox.session.questionBody'),
    };
  }
  return {
    sender: name,
    short: t('inbox.session.blockedShort', { name }),
    source,
    title: t('inbox.session.blockedTitle', { name }),
    body: t('inbox.session.blockedBody'),
  };
}

/**
 * Whether a failed run can be answered from its card (Open, Run again): not
 * when its automation was deleted, nor for a run with no agent, which no
 * session automation makes.
 */
export function isAnswerableRun(run: Extract<InboxItem, { kind: 'run' }>['run']): boolean {
  return !run.automationDeleted && run.agent !== null;
}

/** The row's and the card's words for one item. Data (names, titles) is the source's own. */
export function inboxCopy(item: InboxItem, t: TFunction): InboxCopy {
  switch (item.kind) {
    case 'session':
      return sessionCopy(item, t);
    case 'approval': {
      const { approval } = item;
      const values = { bot: approval.botName, tool: approval.tool };
      return {
        sender: approval.botName,
        short: t('inbox.approval.short', values),
        source: t('inbox.from.approval'),
        title: t('inbox.approval.title', values),
        body: approval.summary,
      };
    }
    case 'pull': {
      const { pull } = item;
      const values = { number: pull.number, title: pull.title, author: pull.author };
      const ready = item.reason === 'ready';
      return {
        sender: pull.author,
        short: t(ready ? 'inbox.pull.readyShort' : 'inbox.pull.requestedShort', values),
        source: pull.repository,
        title: t(ready ? 'inbox.pull.readyTitle' : 'inbox.pull.requestedTitle', values),
        body: t(ready ? 'inbox.pull.readyBody' : 'inbox.pull.requestedBody', values),
      };
    }
    case 'run': {
      const { run } = item;
      const values = { name: run.automationName };
      return {
        sender: run.automationName,
        short: t('inbox.run.short', values),
        source: t('inbox.from.run'),
        title: t('inbox.run.title', values),
        body:
          run.turn?.failureDetail?.trim() ||
          t(isAnswerableRun(run) ? 'inbox.run.body' : 'inbox.run.plainBody'),
      };
    }
  }
}

/**
 * Whether the list's words find an item: in its sender, subject, body or
 * source, as the frame's search reads a row. Case is ignored.
 */
export function matchesQuery(copy: InboxCopy, query: string): boolean {
  const words = query.trim().toLowerCase();
  if (!words) return true;
  return [copy.sender, copy.short, copy.body, copy.source].join(' ').toLowerCase().includes(words);
}

/** "XRP Mobile · acme/app": the item's projects, then its source, as the message writes it under its sender. */
export function inboxFrom(
  item: InboxItem,
  source: string,
  projectName: (id: string) => string | undefined,
): string {
  const names = item.projectIds.flatMap((id) => projectName(id) ?? []);
  return [...names, source].join(' · ');
}
