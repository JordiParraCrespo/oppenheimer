'use client';

import { useState } from 'react';
import { ApprovalCommand } from '@oppenheimer/design-system-web/chat-decisions';
import { Input } from '@oppenheimer/design-system-web/input';
import { Button } from '@oppenheimer/design-system-web/button';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import {
  Check,
  Clock,
  EllipsisIcon,
  GitPullRequest,
  PanelLeft,
  SlidersVertical,
  Terminal,
  TrendingDown,
  X,
} from '@oppenheimer/design-system-web/icons';
import {
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
  InboxMessageChoices,
  InboxMessageFacts,
  InboxClear,
  InboxItem,
  InboxItemSkeleton,
  InboxList,
  InboxListHead,
  InboxQuestion,
  InboxQuestionOption,
  InboxQuestionOptions,
  InboxQuestions,
  InboxSnoozedRow,
  InboxToolbar,
} from '@oppenheimer/design-system-web/inbox';
import { StatusDot } from '@oppenheimer/design-system-web/status-dot';

import { Spec, ThemePair } from './page-shell';

function InboxListDemo() {
  return (
    <div className="w-90 border border-border-subtle">
      <InboxListHead
        title="Inbox"
        count="2 unread"
        leading={
          <IconButton variant="quiet" size="sm" aria-label="Toggle sidebar">
            <PanelLeft />
          </IconButton>
        }
      >
        <IconButton variant="quiet" size="xs" aria-label="Filter the Inbox">
          <SlidersVertical />
        </IconButton>
      </InboxListHead>
      <InboxList>
        <InboxItem
          sender="pau-g"
          title="Merge #121 Port to peersyst"
          preview="Nothing is holding it: it can merge now."
          meta="6m"
          active
          action={
            <IconButton size="xs" variant="quiet" aria-label="Item actions">
              <EllipsisIcon />
            </IconButton>
          }
        />
        <InboxItem
          sender="Ops"
          title="Approve Ops · start_session"
          preview="Start a session on acme/app to fix the flaky login test."
          meta="14m"
          unread
        />
        <InboxItem
          sender="sign-in rebuild"
          title="sign-in rebuild is waiting on you"
          preview="Its agent stopped to ask before it goes on."
          meta="31m"
          unread
        />
        <InboxItem
          sender="Nightly audit"
          title="Nightly audit failed"
          preview="The run ended on a failure."
          meta="1h"
          done
        />
        <InboxItemSkeleton />
      </InboxList>
      <div className="px-2.5 py-2">
        <InboxSnoozedRow
          title="Review #88 Wallet list"
          until="Back Thu 09:00"
          action={
            <Button size="xs" variant="secondary">
              Bring back
            </Button>
          }
        />
      </div>
    </div>
  );
}

function InboxPaneDemo() {
  return (
    <div className="flex w-full max-w-160 flex-col border border-border-subtle">
      <InboxToolbar position="1 of 3">
        <IconButton aria-label="Mark as done">
          <Check />
        </IconButton>
        <IconButton aria-label="Snooze until tomorrow">
          <Clock />
        </IconButton>
        <IconButton aria-label="Deprioritize">
          <TrendingDown />
        </IconButton>
        <IconButton aria-label="Delete">
          <X />
        </IconButton>
      </InboxToolbar>
      <InboxMessage
        icon={<GitPullRequest />}
        sender="pau-g"
        meta="XRP Mobile · acme/xrp-mobile"
        title="Merge #121 · Port to peersyst?"
        age="6m ago"
      >
        <InboxMessageBody>Nothing is holding it: it can merge now.</InboxMessageBody>
        <InboxMessageFacts>
          <span className="flex items-center gap-1.5">
            <StatusDot state="passing" /> Checks passing
          </span>
          <span className="figures">+84 −41</span>
        </InboxMessageFacts>
        <InboxMessageActions
          leading={
            <>
              <Button variant="ghost">Later</Button>
              <Button variant="secondary">Open</Button>
            </>
          }
        >
          <Button>Merge</Button>
        </InboxMessageActions>
      </InboxMessage>
      <div className="flex min-h-40 border-t border-border-subtle">
        <InboxClear title="Nothing needs you">
          3 sessions are still running. New items land here when one needs a decision.
        </InboxClear>
      </div>
    </div>
  );
}

const QUESTIONS = [
  {
    header: 'Gateway',
    question: 'Keep the REST gateway alongside gRPC?',
    multiSelect: false,
    options: [{ label: 'Keep both' }, { label: 'gRPC only', description: 'REST clients move in 0.3' }],
  },
  {
    header: 'Limits',
    question: 'Where should rate limits live?',
    multiSelect: true,
    options: [{ label: 'Gateway' }, { label: 'Each service' }, { label: 'Redis' }],
  },
];

function InboxDecisionDemo() {
  const [picks, setPicks] = useState<number[][]>([[0], []]);
  return (
    <div className="flex w-full max-w-160 flex-col gap-4 border border-border-subtle">
      <InboxMessage
        icon={<Terminal />}
        sender="lively-alder"
        meta="acme/app · fix-wallet"
        title="Do you want to proceed?"
        age="2m"
      >
        <InboxMessageBody>Claude Code stopped before it runs this.</InboxMessageBody>
        <ApprovalCommand>{'Bash command\n  pnpm generate:api-client'}</ApprovalCommand>
        <InboxMessageChoices>
          <Button>Yes</Button>
          <Button variant="secondary">Yes, and don’t ask again for pnpm commands</Button>
          <Button variant="ghost">No, and tell Claude what to do differently</Button>
        </InboxMessageChoices>
        <InboxMessageActions
          leading={
            <>
              <Button variant="ghost">Later</Button>
              <Button variant="secondary">Open session</Button>
            </>
          }
        />
      </InboxMessage>
      <InboxMessage
        icon={<Terminal />}
        sender="gateway"
        meta="acme/gateway · routing"
        title="2 questions before gateway continues"
        age="14m"
      >
        <InboxMessageBody>Pick an answer for each, or write your own, and it goes on.</InboxMessageBody>
        <InboxQuestions>
          {QUESTIONS.map((q, i) => (
            <InboxQuestion key={q.question} n={i + 1} header={q.header} question={q.question}>
              <InboxQuestionOptions
                multiple={q.multiSelect}
                value={picks[i] ?? []}
                onValueChange={(next) => setPicks(picks.map((p, j) => (j === i ? next : p)))}
                aria-label={q.question}
              >
                {q.options.map((o, j) => (
                  <InboxQuestionOption key={o.label} index={j} label={o.label} description={o.description} />
                ))}
              </InboxQuestionOptions>
              <Input size="sm" placeholder="Other…" aria-label="Your own answer" />
            </InboxQuestion>
          ))}
        </InboxQuestions>
        <InboxMessageActions leading={<Button variant="ghost">Later</Button>}>
          <Button disabled={picks.some((p) => p.length === 0)}>Send answers</Button>
        </InboxMessageActions>
      </InboxMessage>
    </div>
  );
}

/** The Inbox's parts: the list column's head and mail rows, the reading pane's toolbar, message and clear state. */
export function InboxSpec() {
  return (
    <Spec
      id="inbox"
      title="Inbox"
      meta="inbox.tsx"
      desc="One place for what needs you, laid out as a mail client inside Plan (Inbox.dc.html). The list column opens on InboxListHead (the sidebar toggle, the name, the unread count, the filter); InboxItem is a mail row: an unread dot, who it is from with a mono age or Low, the subject and a line of its body, unread rows in semibold, the one in the reading pane on the selected wash, a done row (Show done) struck through at half strength, and the ellipsis over the age on hover. InboxItemSkeleton holds a row's place while the Inbox loads; InboxSnoozedRow lists a snoozed item with when it comes back and Bring back. The reading pane opens on InboxToolbar (Mark as done, Snooze, Deprioritize, Delete and the item's place), then InboxMessage: the question as a heading, the sender on a round glyph with where it comes from and how long ago, then InboxMessageBody, InboxMessageFacts and InboxMessageActions with Later and a link on the left and the answers on the right; InboxClear says nothing needs you. A session waiting on a decision answers in the message: a permission's options as InboxMessageChoices in the agent's order (the command in an ApprovalCommand above), a question's as InboxQuestions, each InboxQuestion numbered with its tag, its InboxQuestionOptions pills (one, or several) and a field for an answer of its own."
      code={`<InboxList><InboxItem sender="pau-g" title="Merge #121" preview="It can merge now." meta="6m" unread action={menu} /></InboxList>
<InboxMessage icon={<Bot />} sender="Ops" meta="Bot approval" title="Approve start_session?" age="14m ago"><InboxMessageBody>…</InboxMessageBody><InboxMessageActions leading={<Button variant="ghost">Later</Button>}><Button>Approve</Button></InboxMessageActions></InboxMessage>`}
    >
      <ThemePair>
        <div className="flex flex-col gap-8 lg:flex-row">
          <InboxListDemo />
          <InboxPaneDemo />
        </div>
        <InboxDecisionDemo />
      </ThemePair>
    </Spec>
  );
}
