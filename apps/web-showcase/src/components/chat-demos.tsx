'use client';

import * as React from 'react';

import { Button } from '@oppenheimer/design-system-web/button';
import {
  AnsweredQuestions,
  ChangedFileRow,
  ChangedFilesCard,
  ContextCard,
  ProposedPlanCard,
  QuestionsPill,
  SubagentRow,
  SubagentRunCard,
} from '@oppenheimer/design-system-web/chat-cards';
import {
  ComposerContextMeter,
  ComposerMenu,
  ComposerMenuGroup,
  ComposerMenuItem,
  VoiceRecorderBar,
} from '@oppenheimer/design-system-web/chat-composer-extras';
import {
  ComposerNotice,
  ComposerStack,
  ComposerStackAction,
  ComposerStackRow,
  ComposerTaskList,
} from '@oppenheimer/design-system-web/chat-composer-stack';
import {
  ApprovalApp,
  ApprovalCommand,
  ApprovalFile,
  ApprovalPanel,
  QuestionPanel,
} from '@oppenheimer/design-system-web/chat-decisions';
import {
  ChatEmptyState,
  ChatHeader,
  ChatHeaderTag,
  ChatTab,
  ChatTabStrip,
  ChatTrayButton,
  ThreadFindBar,
} from '@oppenheimer/design-system-web/chat-header';
import {
  ChatErrorAction,
  ChatErrorBanner,
  ChatNotice,
  FloatingChip,
  TranscriptDivider,
} from '@oppenheimer/design-system-web/chat-status';
import {
  ChatAttachment,
  ChatMention,
  ChatReply,
  ChatTranscript,
  ChatUserMessage,
  MessageTrail,
  StreamingCaret,
  TurnHeader,
} from '@oppenheimer/design-system-web/chat-transcript';
import { ReasoningRow, ToolCallGroup, ToolCallLive, ToolCallRow } from '@oppenheimer/design-system-web/chat-work';
import { CodeBlock } from '@oppenheimer/design-system-web/code-block';
import { DiffStat } from '@oppenheimer/design-system-web/diff-stat';
import { DropdownMenuItem } from '@oppenheimer/design-system-web/dropdown-menu';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import {
  ActivityIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  BotIcon,
  BoxesIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  CpuIcon,
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  FolderIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  GlobeIcon,
  HelpCircleIcon,
  LayersIcon,
  ListChecksIcon,
  LoaderIcon,
  PanelLeftIcon,
  PaperclipIcon,
  PauseIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TerminalIcon,
  WorkflowIcon,
  XIcon,
  ZapIcon,
} from '@oppenheimer/design-system-web/icons';
import { StatusDot } from '@oppenheimer/design-system-web/status-dot';
import { Textarea } from '@oppenheimer/design-system-web/textarea';

/** The chat sits on the pane's recessed ground in the product (grey in light, the canvas in dark), so its cards read as cards here too. */
function ChatSurface({ children }: { children: React.ReactNode }) {
  return <div className="w-full rounded-lg border border-border-subtle bg-canvas-recessed p-6">{children}</div>;
}

const icon = (Icon: React.ComponentType<{ className?: string }>, label: string) => (
  <IconButton size="sm" aria-label={label}>
    <Icon />
  </IconButton>
);

/* ── Transcript ──────────────────────────────────────────────────────────── */

function ChatTranscriptBody() {
  const [open, setOpen] = React.useState(true);
  return (
    <ChatTranscript>
      <ChatUserMessage time="09:12" actions={<>{icon(CopyIcon, 'Copy message')}{icon(PencilIcon, 'Edit message')}</>}>
        When a run is stopped from the console, in-flight tool calls keep running until they time out. Wire cancel
        through the agent gateway.
      </ChatUserMessage>
      <ChatUserMessage
        attachments={
          <>
            <ChatAttachment icon={<FileTextIcon />} name="run-trace.json" meta="48 KB" />
            <ChatAttachment icon={<EyeIcon />} />
            <ChatAttachment icon={<PaperclipIcon />} name="Pasted text" meta="212 lines" />
          </>
        }
      >
        Here&apos;s the trace from the stuck run. <ChatMention>@gateway/cancel.ts</ChatMention> is where I&apos;d start.
      </ChatUserMessage>
      <div className="flex flex-col gap-3.5">
        <TurnHeader state="working" elapsed="12s" />
        <TurnHeader state="done" elapsed="1m 13s" model="Claude Sonnet 4.5" time="09:14" open={open} onToggle={() => setOpen(!open)} />
        <TurnHeader state="stopped" elapsed="41s" />
        <TurnHeader state="interrupted" elapsed="2m 04s" />
        <TurnHeader state="resumed" elapsed="8s">
          Resumed: 2 background tasks finished
        </TurnHeader>
      </div>
      <div className="flex flex-col gap-2.5">
        <ChatReply>
          <p>
            The stop path now reaches the tool layer. Previously <code>stopRun()</code> only flipped the run state.
          </p>
          <h3>What changed</h3>
          <ul>
            <li>
              <strong>One signal per step.</strong> Each step owns an <code>AbortController</code>.
            </li>
            <li>
              <strong>Gateway fans out.</strong> Waits up to 5s, then marks the run stopped.
            </li>
          </ul>
          <CodeBlock
            title="ts · runner/step.ts"
            code={'const ctrl = new AbortController();\nrun.registerStep(step.id, ctrl);\nawait tool.call(input, { signal: ctrl.signal });'}
          />
        </ChatReply>
        <MessageTrail
          actions={<>{icon(CopyIcon, 'Copy reply')}{icon(GitBranchIcon, 'Fork from here')}{icon(RefreshCwIcon, 'Retry')}</>}
          meta="3.1k tokens · 09:14"
        />
      </div>
      <ChatReply>
        <p>
          I&apos;ll add it. The console will show <strong>Cancelling</strong> on the run row while steps settle, then
          switch to
          <StreamingCaret />
        </p>
      </ChatReply>
    </ChatTranscript>
  );
}

/* ── Work and tools ──────────────────────────────────────────────────────── */

function ChatWorkBody() {
  return (
    <div className="flex w-full max-w-184 flex-col gap-4">
      <ToolCallGroup summary="Read 3 files, searched 2 patterns, ran 2 commands" failed="1 failed" defaultOpen>
        <ToolCallRow icon={<FileTextIcon />} verb="Read" target="gateway/cancel.ts" meta="L1–96" />
        <ToolCallRow icon={<SearchIcon />} verb="Searched" target="abortSignal" meta="14 results" />
        <ToolCallRow icon={<GlobeIcon />} verb="Fetched" target="developer.mozilla.org/…/AbortSignal" />
        <ToolCallRow
          icon={<TerminalIcon />}
          verb="Ran"
          target="pnpm test runner"
          meta="exit 1"
          tone="danger"
          output={'$ pnpm test runner\n ✓ step.test.ts (36)\n ✗ cancel.test.ts > tool ignores signal\n   expected 5000 to be less than 5100\n Tests  1 failed | 37 passed'}
        />
        <ToolCallRow icon={<FileTextIcon />} verb="Edited" target="runner/step.ts" meta={<DiffStat additions={42} deletions={8} className="text-[11.5px]" />} />
        <ToolCallRow icon={<DatabaseIcon />} verb="Called" target="linear.get_issue" meta="MCP" />
      </ToolCallGroup>
      <ToolCallLive verb="Running" target="pnpm build --filter console" elapsed="6s" />
      <ReasoningRow label="Thought for 9s" defaultOpen>
        The gateway already holds the run registry, so registering controllers there avoids a second lookup. A tool
        that ignores the signal still needs a ceiling, so the grace period stays.
      </ReasoningRow>
    </div>
  );
}

/* ── Cards ───────────────────────────────────────────────────────────────── */

function ChatCardsBody() {
  return (
    <div className="flex w-full max-w-184 flex-col gap-6">
      <ChangedFilesCard
        title="3 files changed"
        additions={80}
        deletions={12}
        actions={
          <>
            <Button variant="secondary" size="sm">
              Review
            </Button>
            <Button variant="ghost" size="sm">
              Undo
            </Button>
          </>
        }
      >
        <ChangedFileRow path="runner/step.ts" additions={42} deletions={8} onOpenInEditor={() => {}} />
        <ChangedFileRow path="gateway/cancel.ts" additions={29} deletions={4} onOpenInEditor={() => {}} />
        <ChangedFileRow path="gateway/cancel.test.ts" additions={9} deletions={0} onOpenInEditor={() => {}} />
      </ChangedFilesCard>
      <ProposedPlanCard
        title="Cancel in-flight tool calls"
        actions={<>{icon(CopyIcon, 'Copy plan')}{icon(DownloadIcon, 'Download plan')}</>}
        collapsible
        onRefine={() => {}}
        onImplement={() => {}}
        implementMenu={
          <>
            <DropdownMenuItem>Implement in a new session</DropdownMenuItem>
            <DropdownMenuItem>Implement on mac-studio</DropdownMenuItem>
          </>
        }
      >
        <ol>
          <li>
            Create an <code>AbortController</code> per step and register it on the run.
          </li>
          <li>Pass the signal into every tool call.</li>
          <li>
            Fan out aborts from <code>gateway/cancel.ts</code> with a 5s grace period.
          </li>
          <li>Add tests for a tool that ignores the signal.</li>
          <li>Show Cancelling on the console run row.</li>
          <li>Keep finished steps and their outputs in the trace.</li>
          <li>Document the grace period in the runner notes.</li>
        </ol>
      </ProposedPlanCard>
      <SubagentRunCard
        live
        onStopAll={() => {}}
        summary={
          <>
            <span className="font-medium text-fg">3 subagents</span>·<span>1 running</span>·
            <span className="text-danger">1 failed</span>·<span className="font-mono text-[12px]">48s</span>
          </>
        }
      >
        <SubagentRow name="Explorer" role="search" model="Claude Haiku 4.5" state="running" activity={'rg "signal" packages/tools'} elapsed="12s" />
        <SubagentRow name="Tester" role="verify" model="GPT-5 Codex" state="completed" elapsed="31s" outcome="38 tests pass, including cancel.test.ts" />
        <SubagentRow name="Reviewer" role="review" model="Claude Opus 4.1" state="failed" elapsed="5s" outcome="Rate limit reached" note="launched 2 subagents" />
      </SubagentRunCard>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <QuestionsPill>2 questions</QuestionsPill>
          <QuestionsPill answered>1 question</QuestionsPill>
        </div>
        <AnsweredQuestions
          items={[
            { question: 'Which branch should the PR target?', answer: 'main' },
            { question: 'Keep the 5s grace period configurable?', answer: 'Yes, per workspace' },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <ContextCard
          icon={<GitPullRequestIcon />}
          tone="success"
          title="Cancel in-flight tool calls on stop"
          meta={
            <>
              <span className="font-mono">#668</span> · acme/cancel-path → main · 2 checks passing
            </>
          }
          action={
            <Button variant="secondary" size="sm">
              Open
            </Button>
          }
        />
        <ContextCard
          icon={<ZapIcon />}
          title="Automation created"
          meta={
            <>
              Nightly flaky-test sweep · weekdays <span className="font-mono">02:00</span>
            </>
          }
          action={
            <Button variant="secondary" size="sm">
              View
            </Button>
          }
        />
      </div>
    </div>
  );
}

/* ── Dividers and status ─────────────────────────────────────────────────── */

function ChatStatusBody() {
  return (
    <div className="flex w-full max-w-184 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <TranscriptDivider icon={<WorkflowIcon />}>
          Context handoff <span>Claude Sonnet 4.5</span>
          <ArrowRightIcon />
          <span className="text-fg">
            GPT-5 Codex <span className="text-fg-subtle">High</span>
          </span>
        </TranscriptDivider>
        <TranscriptDivider icon={<AlertCircleIcon />} tone="danger">
          Handoff failed <span>Claude Sonnet 4.5</span>
          <ArrowRightIcon />
          <span className="line-through">Gemini 2.5 Pro</span>
        </TranscriptDivider>
        <TranscriptDivider icon={<GitBranchIcon />}>
          <a href="#chatstatus" className="text-[14px] text-link">
            Continued from chat
          </a>
        </TranscriptDivider>
      </div>
      <ChatErrorBanner
        title="Turn failed"
        onDismiss={() => {}}
        actions={
          <>
            <ChatErrorAction variant="quiet">
              <CopyIcon />
              Copy error
            </ChatErrorAction>
            <ChatErrorAction variant="danger">Continue task</ChatErrorAction>
            <ChatErrorAction>Change model</ChatErrorAction>
          </>
        }
      >
        anthropic: 529 overloaded_error — The API is temporarily overloaded. Request id req_011CT8uYv2. The turn stopped
        after 4 of 6 steps; completed edits to runner/step.ts and gateway/cancel.ts are kept. Retrying with backoff did
        not succeed after 3 attempts over 41s.
      </ChatErrorBanner>
      <div className="flex flex-col gap-2.5">
        <ChatNotice tone="warning" onDismiss={() => {}}>
          Approaching rate limit (<span className="font-mono">87%</span> used). Resets in <span className="font-mono">14m</span>.
        </ChatNotice>
        <ChatNotice tone="danger">
          Rate limit reached. Resets in <span className="font-mono">42s</span>.
        </ChatNotice>
        <ChatNotice tone="pending" action={<ChatErrorAction>Check setup</ChatErrorAction>}>
          Codex CLI is reconnecting. Messages you send are held until it&apos;s back.
        </ChatNotice>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FloatingChip>
          <LoaderIcon className="text-success motion-safe:animate-spin" />
          <span className="font-mono">2</span> running
          <span aria-hidden className="h-3 w-px bg-border" />
          <ArrowUpIcon className="text-fg-subtle" />
        </FloatingChip>
        <FloatingChip>
          Jump to latest
          <ChevronDownIcon />
        </FloatingChip>
        <FloatingChip variant="notice">
          <ActivityIcon />
          Watching CI on #668
        </FloatingChip>
      </div>
    </div>
  );
}

/* ── Above the composer ──────────────────────────────────────────────────── */

function FakeField({ placeholder, stop }: { placeholder: string; stop?: boolean }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-card">
      <div className="min-h-11.5 px-3.5 pt-3 pb-1.5 text-[15px] leading-[1.55] text-fg-subtle">{placeholder}</div>
      <div className="flex items-center gap-1 pr-2 pb-2 pl-1.5">
        <span className="flex-1" />
        <span className="flex size-7 items-center justify-center rounded-pill bg-fg text-canvas">
          {stop ? <span className="size-2.25 rounded-[2px] bg-current" /> : <ArrowUpIcon className="size-3.5" />}
        </span>
      </div>
    </div>
  );
}

function ChatStackBody() {
  return (
    <div className="flex w-full max-w-184 flex-col gap-8">
      <div className="flex flex-col">
        <ComposerStack>
          <ComposerStackRow icon={<CheckCircleIcon />} actions={icon(PauseIcon, 'Pause goal')}>
            <span className="text-fg-muted">Goal</span> · Stop must cancel in-flight tool calls within 5s
          </ComposerStackRow>
          <div className="flex flex-col">
            <ComposerStackRow icon={<SlidersHorizontalIcon />} muted actions={<>{icon(PanelLeftIcon, 'Open tasks sidebar')}{icon(ChevronDownIcon, 'Collapse task banner')}</>}>
              <span className="font-mono">2</span> out of <span className="font-mono">5</span> tasks completed
            </ComposerStackRow>
            <ComposerTaskList
              tasks={[
                { id: '1', label: 'Register a controller per step', state: 'done' },
                { id: '2', label: 'Pass the signal into tool calls', state: 'done' },
                { id: '3', label: 'Fan out aborts with a grace period', state: 'running' },
                { id: '4', label: 'Test a tool that ignores the signal', state: 'todo' },
                { id: '5', label: 'Show Cancelling on the run row', state: 'todo' },
              ]}
              foot={
                <>
                  <BotIcon />
                  <span className="font-mono">1</span> background agent
                </>
              }
            />
          </div>
          <ComposerStackRow icon={<FileTextIcon />} actions={<ComposerStackAction>Review</ComposerStackAction>}>
            <span className="font-medium">3 files changed</span> <DiffStat additions={80} deletions={12} className="ml-1.5 text-[12px]" />
          </ComposerStackRow>
          <ComposerStackRow
            icon={<PauseIcon />}
            muted
            actions={
              <>
                <ComposerStackAction>Resume</ComposerStackAction>
                <ComposerStackAction>Edit</ComposerStackAction>
              </>
            }
          >
            <strong>Queue paused</strong> · Paused after you stopped the turn
          </ComposerStackRow>
          <ComposerStackRow
            icon={<ArrowUpRightIcon />}
            actions={
              <>
                <ComposerStackAction variant="quiet">Steer</ComposerStackAction>
                {icon(PencilIcon, 'Edit queued message')}
                {icon(XIcon, 'Remove queued message')}
              </>
            }
          >
            <span className="font-medium">Also cover the MCP tools</span>
          </ComposerStackRow>
        </ComposerStack>
        <FakeField placeholder="Reply, or type / for commands" stop />
      </div>
      <div className="flex flex-col gap-2.5">
        <ComposerNotice
          icon={<HelpCircleIcon />}
          action={
            <>
              <ComposerStackAction>Try it</ComposerStackAction>
              {icon(XIcon, 'Dismiss tip')}
            </>
          }
        >
          Press <span className="font-mono text-[12px]">⇧Tab</span> to switch to plan mode before large changes.
        </ComposerNotice>
        <ComposerNotice icon={<GitBranchIcon className="text-warning" />} action={<ComposerStackAction>Switch branch</ComposerStackAction>}>
          Thread is on <span className="font-mono text-[12px]">acme/cancel-path</span>, worktree is on{' '}
          <span className="font-mono text-[12px]">main</span>
        </ComposerNotice>
        <ComposerNotice icon={<ClockIcon />} action={<ComposerStackAction>Wake now</ComposerStackAction>}>
          Snoozed until <span className="font-mono text-[12px]">14:00</span>. The agent resumes on its own.
        </ComposerNotice>
        <ComposerNotice icon={<span className="size-1.5 rounded-pill bg-warning motion-safe:animate-pulse-dot" />}>
          Reconnecting to <span className="font-mono text-[12px]">optimus</span>… messages are held
        </ComposerNotice>
      </div>
    </div>
  );
}

/* ── Decisions ───────────────────────────────────────────────────────────── */

const APPROVAL_CHOICES = [
  { label: 'Yes', description: 'Run it once', tone: 'primary' as const },
  { label: 'Yes, and don’t ask again', description: 'for pnpm test in this project' },
  { label: 'No, and tell the agent what to do differently', tone: 'danger' as const },
];

function ChatDecisionsBody() {
  const [kind, setKind] = React.useState<'command' | 'file' | 'computer'>('command');
  const [pick, setPick] = React.useState<number | null>(0);
  const detail =
    kind === 'command' ? (
      <ApprovalCommand>pnpm test runner -- --run cancel.test.ts</ApprovalCommand>
    ) : kind === 'file' ? (
      <ApprovalFile name="cancel.ts" folder="packages/gateway/src" />
    ) : (
      <ApprovalApp icon={<GlobeIcon />} name="Safari" description="Clicks, typing and scrolling in this app until the response ends" />
    );
  return (
    <div className="flex w-full max-w-184 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex gap-1">
          {(['command', 'file', 'computer'] as const).map((k) => (
            <Button key={k} size="sm" variant={k === kind ? 'secondary' : 'ghost'} onClick={() => setKind(k)}>
              {{ command: 'Command', file: 'File change', computer: 'Computer use' }[k]}
            </Button>
          ))}
        </div>
        <ApprovalPanel
          title={kind === 'command' ? 'Run this command?' : kind === 'file' ? 'Apply these changes?' : 'Allow computer use?'}
          tool={kind === 'command' ? 'Bash' : kind === 'file' ? 'Edit' : 'Computer'}
          position="1/2"
          detail={detail}
          choices={APPROVAL_CHOICES}
          onChoose={() => {}}
        />
      </div>
      <QuestionPanel
        question="Which branch should the pull request target?"
        index={0}
        total={2}
        options={[
          { label: 'main', description: 'The default branch' },
          { label: 'release/0.9', description: 'Ships with Thursday’s cut' },
          { label: 'acme/cancel-path', description: 'Stack on the open PR' },
        ]}
        value={pick}
        onValueChange={setPick}
        answer={<Textarea rows={2} placeholder="Or type your own answer…" aria-label="Your answer" />}
        foot={
          <>
            <span className="flex-1">The agent keeps working while you answer</span>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
            <Button size="sm">Next</Button>
          </>
        }
      />
    </div>
  );
}

/* ── Composer extras ─────────────────────────────────────────────────────── */

const LEVELS = [0.2, 0.35, 0.5, 0.3, 0.7, 0.9, 0.6, 0.4, 0.75, 0.55, 0.3, 0.45, 0.8, 0.65, 0.35, 0.5, 0.9, 0.7, 0.4, 0.25, 0.6, 0.85, 0.5, 0.3];

function ChatComposerExtrasBody() {
  return (
    <div className="flex w-full max-w-240 flex-col gap-6">
      <div className="flex max-w-184 flex-col gap-2.5">
        <VoiceRecorderBar levels={LEVELS} elapsed="0:07" onCancel={() => {}} onStop={() => {}} />
        <VoiceRecorderBar state="waiting" />
        <VoiceRecorderBar state="transcribing" />
        <div className="flex items-center gap-2">
          <ComposerContextMeter value={23} onCompact={() => {}} />
          <ComposerContextMeter value={78} onCompact={() => {}} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <ComposerMenu>
          <ComposerMenuGroup label="Built-in">
            <ComposerMenuItem icon={<LayersIcon />} description="Think before changing anything" hint="/plan" highlighted>
              Plan
            </ComposerMenuItem>
            <ComposerMenuItem icon={<ListChecksIcon />} description="Review the working tree" hint="/review">
              Review
            </ComposerMenuItem>
            <ComposerMenuItem icon={<CpuIcon />} description="Summarise and free context" hint="/compact">
              Compact
            </ComposerMenuItem>
          </ComposerMenuGroup>
          <ComposerMenuGroup label="Skills">
            <ComposerMenuItem icon={<BoxesIcon />} description="Write tests in the repo's style">
              test-writer
            </ComposerMenuItem>
          </ComposerMenuGroup>
        </ComposerMenu>
        <ComposerMenu>
          <ComposerMenuGroup label="Files">
            <ComposerMenuItem icon={<FileTextIcon />} mono description="packages/gateway" highlighted>
              cancel.ts
            </ComposerMenuItem>
            <ComposerMenuItem icon={<FileTextIcon />} mono description="packages/gateway">
              cancel.test.ts
            </ComposerMenuItem>
            <ComposerMenuItem icon={<FolderIcon />} mono>
              runner/
            </ComposerMenuItem>
          </ComposerMenuGroup>
          <ComposerMenuGroup label="Agents and threads">
            <ComposerMenuItem icon={<BotIcon />} description="Claude Opus 4.1">
              Reviewer
            </ComposerMenuItem>
            <ComposerMenuItem icon={<GitPullRequestIcon />}>#668 Cancel in-flight tool calls</ComposerMenuItem>
          </ComposerMenuGroup>
        </ComposerMenu>
        <ComposerMenu>
          <ComposerMenuItem icon={<PaperclipIcon />} hint="⌘U">
            Attach files
          </ComposerMenuItem>
          <ComposerMenuItem icon={<TerminalIcon />} hint="⌘⇧T">
            Add terminal output
          </ComposerMenuItem>
          <ComposerMenuItem icon={<GitPullRequestIcon />}>Add a pull request</ComposerMenuItem>
          <ComposerMenuItem icon={<LayersIcon />} hint="⇧Tab">
            Plan mode
          </ComposerMenuItem>
        </ComposerMenu>
      </div>
      <p className="m-0 max-w-184 text-[15px] leading-[1.55]">
        Use <ChatMention>@gateway/cancel.ts</ChatMention> and the{' '}
        <ChatMention variant="token" icon={<BoxesIcon />}>
          test-writer
        </ChatMention>{' '}
        skill. Ask{' '}
        <ChatMention variant="token" icon={<BotIcon />}>
          Reviewer
        </ChatMention>{' '}
        to check it.
      </p>
    </div>
  );
}

/* ── Header, find and empty state ────────────────────────────────────────── */

function ChatChromeBody() {
  const [query, setQuery] = React.useState('abort');
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <ChatTabStrip onNew={() => {}}>
          <ChatTab active dot="success" onClose={() => {}}>
            Wire run cancel…
          </ChatTab>
          <ChatTab>Quota warning at 90%</ChatTab>
          <ChatTab dot="warning">Retry policy</ChatTab>
        </ChatTabStrip>
        <ChatHeader
          title="Wire run cancel through the agent gateway"
          meta={<ChatHeaderTag icon={<GitBranchIcon />}>acme/cancel-path</ChatHeaderTag>}
          status={
            <StatusDot state="running" pulse density="compact" className="text-[12.5px] text-fg-muted">
              Running
            </StatusDot>
          }
          actions={
            <>
              <Button variant="secondary" size="sm">
                <ExternalLinkIcon />
                Open
              </Button>
              {icon(TerminalIcon, 'Terminal')}
              {icon(GitPullRequestIcon, 'Diff')}
              {icon(PanelLeftIcon, 'Environment')}
            </>
          }
        />
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <ThreadFindBar value="" onValueChange={() => {}} onClose={() => {}} />
        <ThreadFindBar value={query} onValueChange={setQuery} current={2} total={7} onClose={() => setQuery('')} />
      </div>
      <ChatEmptyState
        title="What should the agent work on?"
        tray={
          <>
            <ChatTrayButton icon={<FolderIcon />}>acme-web</ChatTrayButton>
            <ChatTrayButton icon={<CpuIcon />}>New worktree</ChatTrayButton>
            <ChatTrayButton icon={<GitBranchIcon />} mono>
              main
            </ChatTrayButton>
          </>
        }
      >
        <FakeField placeholder="Describe the task, or type / for commands" />
      </ChatEmptyState>
    </div>
  );
}

export function ChatTranscriptDemo() {
  return (
    <ChatSurface>
      <ChatTranscriptBody />
    </ChatSurface>
  );
}

export function ChatWorkDemo() {
  return (
    <ChatSurface>
      <ChatWorkBody />
    </ChatSurface>
  );
}

export function ChatCardsDemo() {
  return (
    <ChatSurface>
      <ChatCardsBody />
    </ChatSurface>
  );
}

export function ChatStatusDemo() {
  return (
    <ChatSurface>
      <ChatStatusBody />
    </ChatSurface>
  );
}

export function ChatStackDemo() {
  return (
    <ChatSurface>
      <ChatStackBody />
    </ChatSurface>
  );
}

export function ChatDecisionsDemo() {
  return (
    <ChatSurface>
      <ChatDecisionsBody />
    </ChatSurface>
  );
}

export function ChatComposerExtrasDemo() {
  return (
    <ChatSurface>
      <ChatComposerExtrasBody />
    </ChatSurface>
  );
}

export function ChatChromeDemo() {
  return (
    <ChatSurface>
      <ChatChromeBody />
    </ChatSurface>
  );
}
