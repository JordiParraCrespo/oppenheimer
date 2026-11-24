'use client';

import { useState } from 'react';
import { ApprovalCommand } from '@oppenheimer/design-system-web/chat-decisions';
import { Input } from '@oppenheimer/design-system-web/input';
import { Button } from '@oppenheimer/design-system-web/button';
import { Checkbox } from '@oppenheimer/design-system-web/checkbox';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import {
  Check,
  Clock,
  EllipsisIcon,
  GitPullRequest,
  SlidersVertical,
  Terminal,
  Trash2,
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
  InboxQuestionSteps,
  InboxSelectionHead,
  InboxSnoozedRow,
  InboxAnswerSummary,
  InboxDeck,
  InboxDock,
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

function InboxSelectionDemo() {
  const menu = (
    <IconButton size="xs" variant="quiet" aria-label="Item actions">
      <EllipsisIcon />
    </IconButton>
  );
  return (
    <div className="w-90 border border-border-subtle">
      <InboxSelectionHead
        aria-label="Selected items"
        count="2 selected"
        leading={<Checkbox className="size-3.5" indeterminate aria-label="Select all" />}
      >
        <IconButton size="xs" variant="quiet" aria-label="Mark as done">
          <Check />
        </IconButton>
        <IconButton size="xs" variant="quiet" aria-label="Deprioritize">
          <TrendingDown />
        </IconButton>
        <IconButton size="xs" variant="quiet" aria-label="Snooze">
          <Clock />
        </IconButton>
        <IconButton size="xs" variant="quiet" aria-label="Delete">
          <Trash2 />
        </IconButton>
        <IconButton size="xs" variant="quiet" aria-label="Clear selection">
          <X />
        </IconButton>
      </InboxSelectionHead>
      <InboxList>
        <InboxItem
          sender="Oppie"
          title="Oppie has news for you"
          preview="Sentry API-5: four background-summary failures."
          meta="1h"
          selecting
          selected
          select={<Checkbox className="size-3.5" checked aria-label="Select" />}
          action={menu}
        />
        <InboxItem
          sender="Juno"
          title="Juno has news for you"
          preview="Eight tasks are now overdue."
          meta="1d"
          unread
          selecting
          select={<Checkbox className="size-3.5" aria-label="Select" />}
          action={menu}
        />
        <InboxItem
          sender="Pullpo"
          title="Pullpo has news for you"
          preview="I paused my routines while you were away."
          meta="3d"
          selecting
          selected
          select={<Checkbox className="size-3.5" checked aria-label="Select" />}
          action={menu}
        />
      </InboxList>
    </div>
  );
}

function InboxPaneDemo() {
  return (
    <div className="flex w-full max-w-160 flex-col border border-border-subtle">
      <InboxToolbar position="1 of 3" progress={0.4} />
      <div className="bg-canvas-recessed">
        <InboxDeck behind={2} onSwipe={() => {}} swipeLabels={{ right: 'Done', left: 'Next' }}>
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
            <InboxMessageActions>
              <Button>Merge</Button>
              <Button variant="secondary">Open</Button>
            </InboxMessageActions>
          </InboxMessage>
        </InboxDeck>
        <InboxDock
          previous={{ label: 'Previous', keyHint: 'K', onClick: () => {} }}
          done={{ label: 'Done', keyHint: 'E', onClick: () => {} }}
          next={{ label: 'Next', keyHint: 'J', onClick: () => {} }}
        />
      </div>
      <div className="flex min-h-40 border-t border-border-subtle">
        <InboxClear title="You're all caught up">
          3 sessions are still running. New items land here when one needs a decision.
        </InboxClear>
      </div>
    </div>
  );
}

const QUESTION = {
  header: 'Limits',
  question: 'Where should rate limits live?',
  options: [
    { label: 'At the gateway', description: 'One place, but every service trusts it' },
    { label: 'In each service', description: 'Each one enforces its own' },
    { label: 'In Redis, shared', description: 'Needs Redis in every environment' },
  ],
};

function InboxDecisionDemo() {
  const [pick, setPick] = useState<number[]>([1]);
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
          <Button variant="secondary">No, and tell Claude what to do differently</Button>
        </InboxMessageChoices>
        <InboxMessageActions>
          <Button variant="secondary">Open session</Button>
        </InboxMessageActions>
      </InboxMessage>
      <InboxDock
        previous={{ label: 'Previous', keyHint: 'K', onClick: () => {} }}
        next={{ label: 'Next', keyHint: 'J', onClick: () => {} }}
      />
      <InboxMessage
        icon={<Terminal />}
        sender="gateway"
        meta="acme/gateway · routing"
        title="2 questions before gateway continues"
        age="14m"
      >
        <InboxQuestionSteps
          total={3}
          current={1}
          label="Question 2 of 3"
          action={
            <Button variant="ghost" size="xs">
              Back
            </Button>
          }
        />
        <InboxQuestion n={2} header={QUESTION.header} question={QUESTION.question}>
          <InboxQuestionOptions value={pick} onValueChange={setPick} aria-label={QUESTION.question}>
            {QUESTION.options.map((o, j) => (
              <InboxQuestionOption key={o.label} index={j} label={o.label} description={o.description} />
            ))}
          </InboxQuestionOptions>
          <Input size="sm" placeholder="Other…" aria-label="Your own answer" />
        </InboxQuestion>
        <InboxMessageActions>
          <Button variant="secondary">Open session</Button>
        </InboxMessageActions>
      </InboxMessage>
      <InboxMessage icon={<Terminal />} sender="gateway" meta="acme/gateway · routing" title="Ready to send" age="14m">
        <InboxQuestionSteps total={3} current={3} label="Ready to send" />
        <InboxAnswerSummary
          rows={[
            { label: 'Gateway', answer: 'Keep both', editLabel: 'Change', onEdit: () => {} },
            { label: 'Limits', answer: 'In each service', editLabel: 'Change', onEdit: () => {} },
            { label: 'Clients', answer: 'Web, CLI', editLabel: 'Change', onEdit: () => {} },
          ]}
        />
        <InboxMessageActions>
          <Button>Send answers</Button>
          <Button variant="secondary">Open session</Button>
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
      desc="One place for what needs you, a page of its own laid out as a mail client (Inbox.dc.html). The list column opens on InboxListHead (the name, the unread count, the filter); InboxItem is a mail row: an unread dot, who it is from with a mono age or Low, the subject and a line of its body, unread rows in semibold, the one in the reading pane on the selected wash, a done row (Show done) struck through at half strength, and the ellipsis over the age on hover. InboxItemSkeleton holds a row's place while the Inbox loads; InboxSnoozedRow lists a snoozed item with when it comes back and Bring back. A row's select is its Checkbox, in the unread dot's place on hover and on every row once the list is selecting; a selected row takes the selected wash, and InboxSelectionHead takes the head's place with select all, the count and the bulk actions. The deck opens on InboxToolbar (only the item's place and a hairline of how much of the visit is cleared), then InboxDeck: the item in hand as a card on the stack of what is left, which on touch follows a sideways drag and stamps Done or Next, and whose answers wear the number that presses them where there is a keyboard. On the card, InboxMessage: the question as a heading, the sender on a round glyph with where it comes from and how long ago, then InboxMessageBody, InboxMessageFacts and InboxMessageActions, the answers as full-width rows, the main one first. Under the card, InboxDock: Previous, Done (only where the card can be put away) and Next, each with its key. A session waiting on a decision answers on the card: a permission's options as InboxMessageChoices in the agent's order (the command in an ApprovalCommand above); a questionnaire one question at a time, InboxQuestionSteps over an InboxQuestion with its InboxQuestionOptions rows and a field for an answer of its own, then InboxAnswerSummary and Send. InboxClear says nothing needs you."

      code={`<InboxList><InboxItem sender="pau-g" title="Merge #121" preview="It can merge now." meta="6m" unread action={menu} /></InboxList>
<InboxMessage icon={<Bot />} sender="Ops" meta="Bot approval" title="Approve start_session?" age="14m ago"><InboxMessageBody>…</InboxMessageBody><InboxMessageActions><Button>Approve</Button><Button variant="secondary">Deny</Button></InboxMessageActions></InboxMessage>
<InboxDock previous={{ label: 'Previous', onClick }} done={{ label: 'Done', keyHint: 'E', onClick }} next={{ label: 'Next', onClick }} />`}
    >
      <ThemePair>
        <div className="flex flex-col gap-8 lg:flex-row">
          <InboxListDemo />
          <InboxPaneDemo />
        </div>
        <InboxSelectionDemo />
        <InboxDecisionDemo />
      </ThemePair>
    </Spec>
  );
}
