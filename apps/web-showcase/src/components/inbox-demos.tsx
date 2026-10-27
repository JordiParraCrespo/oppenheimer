'use client';

import { useState } from 'react';
import { ApprovalCommand } from '@oppenheimer/design-system-web/chat-decisions';
import { Input } from '@oppenheimer/design-system-web/input';
import { Button } from '@oppenheimer/design-system-web/button';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import {
  Bot,
  EllipsisIcon,
  GitPullRequest,
  Terminal,
  Zap,
} from '@oppenheimer/design-system-web/icons';
import {
  InboxCard,
  InboxCardActions,
  InboxCardBody,
  InboxCardChoices,
  InboxCardFacts,
  InboxClear,
  InboxGreeting,
  InboxItem,
  InboxItemSkeleton,
  InboxList,
  InboxLogLine,
  InboxQuestion,
  InboxQuestionOption,
  InboxQuestionOptions,
  InboxQuestions,
  InboxSnoozedRow,
} from '@oppenheimer/design-system-web/inbox';
import { StatusDot } from '@oppenheimer/design-system-web/status-dot';

import { Spec, ThemePair } from './page-shell';

function InboxListDemo() {
  return (
    <div className="w-72">
      <InboxList>
        <InboxItem
          icon={<GitPullRequest />}
          title="Merge #121 Port to peersyst"
          from="XRP Mobile · acme/xrp-mobile"
          meta="6m"
          active
          action={
            <IconButton size="xs" variant="quiet" aria-label="Item actions">
              <EllipsisIcon />
            </IconButton>
          }
        />
        <InboxItem icon={<Bot />} title="Approve Ops · start_session" from="Ops" meta="14m" />
        <InboxItem icon={<Terminal />} title="sign-in rebuild is blocked" from="XRP Mobile · Session" meta="31m" />
        <InboxItem icon={<Zap />} title="Nightly dependency audit failed" from="Automation" meta="Low" done />
        <InboxItemSkeleton />
        <InboxSnoozedRow
          title="Review #88 Wallet list"
          until="in 1h"
          action={
            <Button size="xs" variant="secondary">
              Bring back
            </Button>
          }
        />
      </InboxList>
    </div>
  );
}

function InboxPaneDemo() {
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-4">
      <InboxGreeting title="Good morning.">3 sessions are running. 2 things need you, one at a time.</InboxGreeting>
      <InboxLogLine time="09:42">Merged #121 into main</InboxLogLine>
      <InboxCard
        icon={<GitPullRequest />}
        from="acme/xrp-mobile · Your pull request"
        title="Merge #121 · Port to peersyst?"
        age="6m"
      >
        <InboxCardBody>It can merge: nothing is holding it.</InboxCardBody>
        <InboxCardFacts>
          <span className="flex items-center gap-1.5">
            <StatusDot state="passing" /> Checks passing
          </span>
          <span className="figures">+84 −41</span>
        </InboxCardFacts>
        <InboxCardActions
          leading={
            <>
              <Button variant="ghost">Later</Button>
              <Button variant="secondary">Review</Button>
            </>
          }
        >
          <Button>Merge</Button>
        </InboxCardActions>
      </InboxCard>
      <InboxClear title="You're clear">3 sessions are still running. The next thing that needs you comes here.</InboxClear>
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
    <div className="flex w-full max-w-160 flex-col gap-4">
      <InboxCard
        icon={<Terminal />}
        from="lively-alder · acme/app · fix-wallet"
        title="Do you want to proceed?"
        age="2m"
      >
        <InboxCardBody>Claude Code stopped before it runs this.</InboxCardBody>
        <ApprovalCommand>{'Bash command\n  pnpm generate:api-client'}</ApprovalCommand>
        <InboxCardChoices>
          <Button>Yes</Button>
          <Button variant="secondary">Yes, and don’t ask again for pnpm commands</Button>
          <Button variant="ghost">No, and tell Claude what to do differently</Button>
        </InboxCardChoices>
        <InboxCardActions
          leading={
            <>
              <Button variant="ghost">Later</Button>
              <Button variant="secondary">Open session</Button>
            </>
          }
        />
      </InboxCard>
      <InboxCard
        icon={<Terminal />}
        from="gateway · acme/gateway · routing"
        title="2 questions before gateway continues"
        age="14m"
      >
        <InboxCardBody>Pick an answer for each, or write your own, and it goes on.</InboxCardBody>
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
        <InboxCardActions leading={<Button variant="ghost">Later</Button>}>
          <Button disabled={picks.some((p) => p.length === 0)}>Send answers</Button>
        </InboxCardActions>
      </InboxCard>
    </div>
  );
}

/** The Inbox's parts: the list's rows in the sidebar, the pane's greeting, log, card and clear state. */
export function InboxSpec() {
  return (
    <Spec
      id="inbox"
      title="Inbox"
      meta="inbox.tsx"
      desc="One place for what needs you (Brain.dc.html). InboxItem is a two-line sidebar row: the kind's glyph, a short line, where it comes from, and a mono age or Low; the item in the pane is on the selected wash, a done row (Show done) is struck through at half strength, and the ellipsis takes the age's place on hover. InboxItemSkeleton holds a row's place while the Inbox loads; InboxSnoozedRow lists a snoozed item with when it comes back and Bring back. In the pane: InboxGreeting opens it, InboxLogLine is one thing done this visit, InboxCard is the item in hand (who from, the question, the age; then InboxCardBody, InboxCardFacts and InboxCardActions with Later and a link on the left and the answers on the right), and InboxClear says nothing needs you. A session waiting on a decision answers on the card: a permission's options as InboxCardChoices in the agent's order (the command in an ApprovalCommand above), a question's as InboxQuestions, each InboxQuestion numbered with its tag, its InboxQuestionOptions pills (one, or several) and a field for an answer of its own."
      code={`<InboxList><InboxItem icon={<GitPullRequest />} title="Merge #121" from="acme/app" meta="6m" active action={menu} /></InboxList>
<InboxCard icon={<Bot />} from="Ops" title="Approve start_session?" age="14m"><InboxCardBody>…</InboxCardBody><InboxCardActions leading={<Button variant="ghost">Later</Button>}><Button>Approve</Button></InboxCardActions></InboxCard>`}
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
