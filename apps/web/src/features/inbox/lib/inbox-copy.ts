import type { InboxItem } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';

/** What a row and the card say about an item, in the reader's language. */
export interface InboxCopy {
  /** The row's short line. */
  short: string;
  /** Where it comes from, without its projects. */
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
      short: t('inbox.session.failedShort', { name }),
      source,
      title: t('inbox.session.failedTitle', { name }),
      body: t('inbox.session.failedBody'),
    };
  }
  if (session.lifecycle === 'starting') {
    return {
      short: t('inbox.session.startingShort', { name }),
      source,
      title: t('inbox.session.startingTitle', { name }),
      body: t('inbox.session.startingBody'),
    };
  }
  const { decision } = session;
  // A decision is answered on the card, which names the session it answers.
  const named = session.scopeLabel ? `${name} · ${session.scopeLabel}` : name;
  if (decision?.kind === 'permission') {
    return {
      short: t('inbox.session.blockedShort', { name }),
      source: named,
      title: decision.title,
      body: t('inbox.session.permissionBody'),
    };
  }
  if (decision?.kind === 'question') {
    return {
      short: t('inbox.session.blockedShort', { name }),
      source: named,
      title: t('inbox.session.questionTitle', { name, count: decision.questions.length }),
      body: t('inbox.session.questionBody'),
    };
  }
  return {
    short: t('inbox.session.blockedShort', { name }),
    source,
    title: t('inbox.session.blockedTitle', { name }),
    body: t('inbox.session.blockedBody'),
  };
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
        short: t('inbox.approval.short', values),
        source: t('inbox.from.approval', values),
        title: t('inbox.approval.title', values),
        body: approval.summary,
      };
    }
    case 'pull': {
      const { pull } = item;
      const values = { number: pull.number, title: pull.title, author: pull.author };
      const ready = item.reason === 'ready';
      return {
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
        short: t('inbox.run.short', values),
        source: t('inbox.from.run'),
        title: t('inbox.run.title', values),
        body: run.turn?.failureDetail?.trim() || t('inbox.run.body'),
      };
    }
  }
}

/** "XRP Mobile · acme/app": the item's projects, then its source, as the frame writes a row's second line. */
export function inboxFrom(
  item: InboxItem,
  source: string,
  projectName: (id: string) => string | undefined,
): string {
  const names = item.projectIds.flatMap((id) => projectName(id) ?? []);
  return [...names, source].join(' · ');
}
