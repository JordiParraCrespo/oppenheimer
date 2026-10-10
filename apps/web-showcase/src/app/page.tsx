'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@oppenheimer/design-system-web/avatar';
import { BrandGlyph } from '@oppenheimer/design-system-web/brand-glyph';
import { BrandMark } from '@oppenheimer/design-system-web/brand-mark';
import { Button } from '@oppenheimer/design-system-web/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@oppenheimer/design-system-web/card';
import { Chip, FilterChip } from '@oppenheimer/design-system-web/chip';
import { CodeBlock } from '@oppenheimer/design-system-web/code-block';
import { EmptyState } from '@oppenheimer/design-system-web/empty-state';
import {
  Field,
  FieldAction,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldRow,
} from '@oppenheimer/design-system-web/field';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import { Input } from '@oppenheimer/design-system-web/input';
import { Kbd } from '@oppenheimer/design-system-web/kbd';
import { Link } from '@oppenheimer/design-system-web/link';
import { PasswordInput } from '@oppenheimer/design-system-web/password-input';
import { Separator } from '@oppenheimer/design-system-web/separator';
import { StatusDot } from '@oppenheimer/design-system-web/status-dot';
import { Textarea } from '@oppenheimer/design-system-web/textarea';
import { AgentMark } from '@oppenheimer/design-system-web/agent-mark';
import { CODING_AGENT_IDS, CODING_AGENTS } from '@oppenheimer/shared/agents';
import { StepHeader } from '@oppenheimer/design-system-web/step-header';
import { SuccessMark } from '@oppenheimer/design-system-web/success-mark';
import { SummaryCard, SummaryRow } from '@oppenheimer/design-system-web/summary-card';
import { Wordmark } from '@oppenheimer/design-system-web/wordmark';
import {
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  MicIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  TerminalIcon,
  XIcon,
} from '@oppenheimer/design-system-web/icons';
import {
  DropZoneNewSessionDemo,
  DropZoneTerminalDemo,
  TerminalHostLinkDemo,
} from '../components/host-link-demos';
import { DatePickerDemo, MonthCalendarDemo } from '../components/calendar-demos';
import { DiffDemo } from '../components/diff-demos';
import { PullRequestAnalyticsDemo } from '../components/pr-analytics-demos';
import { PullRequestBriefingDemo, PullRequestQueueDemo } from '../components/pull-request-demos';
import { DragPrimitivesDemo } from '../components/drag-demos';
import { PlanDialogsDemo, SessionPaneHeaderDemo } from '../components/plan-dialog-demos';
import { TaskBoardDemo, TaskStatusDots } from '../components/task-board-demos';
import {
  AccountMenuDemo,

  CarouselDemo,
  ComposerDemo,
  AddHostDialogDemo,
  DestructiveDialogDemo,
  CheckboxDemo,
  RadioGroupDemo,
  SegmentedDemo,
  SlugFieldDemo,
  FilterMenuDemo,
  AgentModelDemo,
  EffortDemo,
  PermissionDemo,
  ScopeChips,
  RepositoryRowListDemo,
  DisclosureDemo,
  SidebarDemo,
  CalloutDemo,
  PillTabsDemo,
  EditorPageDemo,
  SettingsShellDemo,
  PageHeaderDemo,
  EditorPageWideDemo,
  RunHistoryDemo,
  RoutineTableDemo,
  RunsListDemo,
  TemplateGridDemo,
  FieldSelectGroupDemo,
  RoutineEditorDemo,
  RoutineItemsDemo,
  SettingsNavDemo,
  SettingsGroupDemo,
  HostCardsDemo,
  StepperDemo,
  TerminalDemo,
  TooltipDemo,
} from '@/components/demos';
import {
  ControlRamp,
  Elevation,
  Icons,
  ICON_NAMES,
  Motion,
  Palette,
  Radii,
  SemanticColors,
  SpaceScale,
  TypeLadder,
  Weights,
} from '@/components/foundations';
import { AlertDemo, BadgeDemo, CommandDemo, SkeletonDemo, ToastDemo } from '@/components/feedback';
import { GroupHead, PageHead, PageShell, Spec, Swatch, ThemePair } from '@/components/page-shell';
import { TOC_COUNT } from '@/lib/toc';

export default function Page() {
  return (
    <PageShell>
      <PageHead
        eyebrow="Design system · MVP"
        title="The product is the work. The design system is the silence around it."
        sub={`Achromatic by default, colour rationed to one blue for actions and one for links, one typeface with size and tracking carrying the hierarchy, no shadow on any surface, six radii and no others. ${TOC_COUNT} components, every one of them on an MVP screen.`}
      />

      <GroupHead>Foundations</GroupHead>

      <Spec
        id="colors"
        title="Colours"
        meta="styles/globals.css"
        desc="Two layers. The raw palette (--op-*) is never referenced in product code. Semantic aliases re-point under the dark theme, so a theme switch moves aliases only and no component holds a conditional colour. Dark is the version-1 artboards' lifted ramp: canvas #121213, not true black."
      >
        <Palette />
        <SemanticColors />
      </Spec>

      <Spec
        id="type"
        title="Typography"
        meta="SF Pro Text · SF Pro Display · SF Mono"
        desc="One typeface doing every job. Display is the same family at 600 with tighter tracking, from 21px up. Tracking follows the inverse-size rule: the larger, the tighter. Weight never exceeds 600. Every number a human compares is mono and tabular."
      >
        <TypeLadder />
        <Separator />
        <Weights />
      </Spec>

      <Spec
        id="space"
        title="Space"
        meta="--space-* · --control-h-*"
        desc="A 4px base and one control height ramp. Sections divide by surface shift and whitespace, not by rules."
      >
        <SpaceScale />
        <Separator />
        <ControlRamp />
      </Spec>

      <Spec
        id="radius"
        title="Radii"
        meta="rounded-xs · sm · md · lg · xl · pill"
        desc="Six radii and no others. The rule reads: type into a 10, press a pill, read inside an 18. If a value is not in this list, it is wrong."
      >
        <Radii />
      </Spec>

      <Spec
        id="elevation"
        title="Elevation"
        meta="shadow-popover · shadow-modal"
        desc="Surfaces never cast shadows; depth is tonal. Only three transient layers detach from the page, all soft and ambient: popovers and menus, modals, and glass over media."
      >
        <Elevation />
      </Spec>

      <Spec
        id="motion"
        title="Motion"
        meta="duration-instant · fast · base · slow"
        desc="Short, eased, never bouncy. Four durations, two curves, and a 4px rise plus fade for anything that appears."
      >
        <Motion />
      </Spec>

      <Spec
        id="icons"
        title="Icons"
        meta={`lucide-react · ${ICON_NAMES.length} glyphs on the MVP screens`}
        desc="Lucide, 24px grid, 2px stroke, round caps. Icons inherit currentColor and are never given their own colour; colour the text around them. Status is a dot, not an icon. No emoji, anywhere."
      >
        <Icons />
      </Spec>

      <GroupHead>Core</GroupHead>

      <Spec
        id="wordmark"
        title="Wordmark · BrandMark"
        meta="wordmark.tsx · brand-mark.tsx"
        desc="No logotype exists, so the name is the mark: SF Pro Display 600 at -0.032em. The product suffix is the one place uppercase is allowed."
        code={`<Wordmark product="Console" />`}
      >
        <Swatch label="18px, console">
          <Wordmark product="Console" />
        </Swatch>
        <Swatch label="28px">
          <Wordmark size={28} />
        </Swatch>
        <Swatch label="dark">
          <div className="dark rounded-md bg-canvas px-5 py-3">
            <Wordmark product="Console" />
          </div>
        </Swatch>
        <Swatch label="BrandMark, the auth chrome's glyph">
          <BrandMark size={28} />
        </Swatch>
      </Spec>

      <Spec
        id="buttons"
        title="Button"
        meta="button.tsx"
        desc="Anything you press is a pill, on the 28 / 34 / 42 ramp. One primary per view. Press is a scale to .975, never a hue change. Disabled keeps its shape at 40%. Pending is disabled and aria-busy, and reads its verb in progress; no spinner. It acts; a Link navigates."
        code={`<Button size="lg" block>Sign in</Button>
<Button variant="destructive" pending={remove.isPending} pendingLabel="Deleting…">Delete session</Button>
<Button variant="social" size="lg" block><BrandGlyph name="google" /> Continue with Google</Button>
<Button variant="secondary" size="sm"><CopyIcon /> Copy</Button>`}
      >
        <Swatch label="primary">
          <Button>Start session</Button>
        </Swatch>
        <Swatch label="secondary">
          <Button variant="secondary">Resend link</Button>
        </Swatch>
        <Swatch label="ghost">
          <Button variant="ghost">Keep running</Button>
        </Swatch>
        <Swatch label="outline">
          <Button variant="outline">Open trace</Button>
        </Swatch>
        <Swatch label="destructive">
          <Button variant="destructive">Stop run</Button>
        </Swatch>
        <Swatch label="disabled">
          <Button disabled>Continue</Button>
        </Swatch>
        <Swatch label="pending · pendingLabel">
          <Button pending pendingLabel="Signing in…">
            Sign in
          </Button>
        </Swatch>
        <Swatch label="pending · destructive">
          <Button variant="destructive" pending pendingLabel="Deleting…">
            Delete session
          </Button>
        </Swatch>
        <Swatch label="pending locks its own button; a sibling that waits is disabled">
          <div className="flex gap-2">
            <Button variant="outline" disabled>
              Deny
            </Button>
            <Button pending pendingLabel="Allowing…">
              Allow
            </Button>
          </div>
        </Swatch>
        <Swatch label="sm · 28">
          <Button variant="secondary" size="sm">
            <CopyIcon /> Copy
          </Button>
        </Swatch>
        <Swatch label="md · 34">
          <Button size="md">
            <PlusIcon /> New session
          </Button>
        </Swatch>
        <Swatch label="lg · 42">
          <Button size="lg">Connect GitHub</Button>
        </Swatch>
        <Swatch label="primary with glyph">
          <Button size="lg">
            <BrandGlyph name="github" /> Connect GitHub
          </Button>
        </Swatch>
        <div className="flex w-full max-w-85 flex-col gap-2.5">
          <Button variant="social" size="lg" block>
            <BrandGlyph name="google" /> Continue with Google
          </Button>
          <Button variant="social" size="lg" block>
            <BrandGlyph name="github" /> Continue with GitHub
          </Button>
          <Button size="lg" block>
            Sign in
          </Button>
          <span className="text-xs text-fg-subtle">social · block · lg</span>
        </div>
      </Spec>

      <Spec
        id="iconbuttons"
        title="IconButton"
        meta="icon-button.tsx"
        desc="A square footprint with a pill silhouette on the same ramp. Icon-only, so every one carries an aria-label and, normally, a Tooltip."
        code={`<IconButton aria-label="Filter sessions" size="xs"><Settings2Icon /></IconButton>
<IconButton aria-label="Send" variant="primary" size="sm"><ArrowUpIcon /></IconButton>`}
      >
        <Swatch label="ghost · xs">
          <IconButton aria-label="Filter sessions" size="xs">
            <Settings2Icon />
          </IconButton>
        </Swatch>
        <Swatch label="ghost · sm">
          <IconButton aria-label="Attach" size="sm" shape="square">
            <PaperclipIcon />
          </IconButton>
        </Swatch>
        <Swatch label="ghost · md">
          <IconButton aria-label="Dictate">
            <MicIcon />
          </IconButton>
        </Swatch>
        <Swatch label="solid">
          <IconButton aria-label="New session" variant="solid">
            <TerminalIcon />
          </IconButton>
        </Swatch>
        <Swatch label="outline">
          <IconButton aria-label="Search" variant="outline">
            <SearchIcon />
          </IconButton>
        </Swatch>
        <Swatch label="primary · send">
          <IconButton aria-label="Send" variant="primary" size="sm" className="size-8">
            <ArrowUpIcon strokeWidth={2.5} />
          </IconButton>
        </Swatch>
        <Swatch label="close">
          <IconButton aria-label="Close" size="sm">
            <XIcon />
          </IconButton>
        </Swatch>
        <Swatch label="lg">
          <IconButton aria-label="Add" variant="solid" size="lg">
            <PlusIcon />
          </IconButton>
        </Swatch>
      </Spec>

      <Spec
        id="links"
        title="Link"
        meta="link.tsx"
        desc="The second blue. It navigates; a Button acts. Inherits the surrounding size, underline on hover only. Pass render to use the router's link."
        code={`<Link href="/sign-in">Back to sign in</Link>
<p>No account? <Link href="/register">Create one</Link></p>`}
      >
        <Swatch label="standalone">
          <Link href="#links">Back to sign in</Link>
        </Swatch>
        <Swatch label="inline">
          <p className="text-sm text-fg-muted">
            No account? <Link href="#links">Create one</Link>
          </p>
        </Swatch>
        <Swatch label="muted">
          <p className="text-xs text-fg-subtle">
            By continuing you accept the <Link href="#links">Terms</Link> and{' '}
            <Link href="#links">Privacy Policy</Link>.
          </p>
        </Swatch>
      </Spec>

      <Spec
        id="badges"
        title="Badge"
        meta="badge.tsx"
        desc="Lifecycle state and quiet metadata. The four status variants carry the run-state hues; neutral is the quiet chip for a role or a count. Never a call to action."
        code={`<Badge variant="active">Active</Badge>`}
      >
        <BadgeDemo />
      </Spec>

      <Spec
        id="chips"
        title="Chip · FilterChip"
        meta="chip.tsx"
        desc="A chosen value or a filter: 28px pill, 13px medium, hairline. A leading icon or check goes in front; selected takes the blue tint. FilterChip is the 22px summary of an active filter with a remove button."
        code={`<Chip icon={<CheckIcon className="text-success" />}>git</Chip>
<FilterChip onRemove={clear}>Running only</FilterChip>`}
      >
        <Swatch label="outline">
          <Chip>tmux</Chip>
        </Swatch>
        <Swatch label="with check">
          <div className="flex gap-2">
            <Chip icon={<CheckIcon className="text-success" strokeWidth={2.5} />}>git</Chip>
            <Chip icon={<CheckIcon className="text-success" strokeWidth={2.5} />}>tmux</Chip>
            <Chip icon={<CheckIcon className="text-success" strokeWidth={2.5} />}>claude</Chip>
          </div>
        </Swatch>
        <Swatch label="selected">
          <Chip selected>All</Chip>
        </Swatch>
        <Swatch label="solid">
          <Chip variant="solid">Padded</Chip>
        </Swatch>
        <Swatch label="filter chips">
          <div className="flex gap-1">
            <FilterChip onRemove={() => {}}>Running only</FilterChip>
            <FilterChip onRemove={() => {}}>xrp-mobile</FilterChip>
          </div>
        </Swatch>
      </Spec>

      <Spec
        id="statusdot"
        title="StatusDot"
        meta="status-dot.tsx"
        desc="Status is a dot, not an icon: a 6px dot plus a word. Six states are the vocabulary; do not invent In progress or Error alongside them. Completed shows a green check, meta adds a muted second line."
        code={`<StatusDot state="running" />
<StatusDot state="completed" meta="12 repositories · read access">JordiParraCrespo</StatusDot>`}
      >
        <Swatch>
          <StatusDot state="running" />
        </Swatch>
        <Swatch>
          <StatusDot state="needs-input" />
        </Swatch>
        <Swatch>
          <StatusDot state="failed" />
        </Swatch>
        <Swatch>
          <StatusDot state="queued" />
        </Swatch>
        <Swatch>
          <StatusDot state="completed" />
        </Swatch>
        <Swatch>
          <StatusDot state="idle" />
        </Swatch>
        <Swatch label="pending, pulsing">
          <StatusDot state="pending" pulse>
            Waiting for the host to connect…
          </StatusDot>
        </Swatch>
        <Swatch label="with meta">
          <StatusDot state="completed" meta="12 repositories · read access">
            JordiParraCrespo
          </StatusDot>
        </Swatch>
      </Spec>

      <Spec
        id="avatars"
        title="Avatar"
        meta="avatar.tsx"
        desc="Initials or an image in a pill: sm 22, md 28, lg 38. Neutral by default; accent is the blue tint for the signed-in account. No gradients."
        code={`<Avatar size="sm" variant="accent"><AvatarFallback>JP</AvatarFallback></Avatar>`}
      >
        <Swatch label="sm · accent">
          <Avatar size="sm" variant="accent">
            <AvatarFallback>JP</AvatarFallback>
          </Avatar>
        </Swatch>
        <Swatch label="md">
          <Avatar>
            <AvatarFallback>JP</AvatarFallback>
          </Avatar>
        </Swatch>
        <Swatch label="lg">
          <Avatar size="lg">
            <AvatarFallback>JP</AvatarFallback>
          </Avatar>
        </Swatch>
        <Swatch label="image">
          <Avatar size="lg">
            <AvatarImage src="/imagery/oppenheimer-portrait.webp" alt="" />
            <AvatarFallback>JO</AvatarFallback>
          </Avatar>
        </Swatch>
      </Spec>

      <Spec
        id="separators"
        title="Separator"
        meta="separator.tsx"
        desc="A 1px hairline in the subtle border. Rare on its own, since sections divide by whitespace; the labelled form is the OR between social sign-in and the email form."
        code={`<Separator>or</Separator>`}
      >
        <div className="w-full max-w-85">
          <Separator>or</Separator>
        </div>
        <div className="w-full max-w-85">
          <Separator />
        </div>
        <Swatch label="vertical">
          <div className="flex h-6 items-center gap-3 text-sm text-fg-muted">
            <span>4h 2m</span>
            <Separator orientation="vertical" />
            <span>763.4 MB</span>
          </div>
        </Swatch>
      </Spec>

      <Spec
        id="kbd"
        title="Kbd"
        meta="kbd.tsx"
        desc="A keyboard glyph on the control fill at the 6px radius. Unicode symbols appear in the UI only here."
        code={`<Kbd>⌘</Kbd><Kbd>K</Kbd>`}
      >
        <Swatch label="shortcut">
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </Swatch>
        <Swatch label="submit">
          <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Kbd>⏎</Kbd> to send
          </span>
        </Swatch>
      </Spec>

      <Spec
        id="cards"
        title="Card"
        meta="card.tsx"
        desc="The content container: 18px radius, a subtle hairline, the lit surface on the canvas, no shadow. Header, content and footer carry the 24px padding; padded puts it on the card for a single block."
        code={`<Card><CardHeader><CardTitle>…</CardTitle><CardDescription>…</CardDescription></CardHeader><CardContent>…</CardContent></Card>`}
      >
        <Card className="w-full max-w-90">
          <CardHeader>
            <CardTitle>mac-studio</CardTitle>
            <CardDescription>macOS 15 · echo 38 ms · 3 sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Chip icon={<CheckIcon className="text-success" strokeWidth={2.5} />}>git</Chip>
              <Chip icon={<CheckIcon className="text-success" strokeWidth={2.5} />}>tmux</Chip>
              <Chip icon={<CheckIcon className="text-success" strokeWidth={2.5} />}>claude</Chip>
            </div>
          </CardContent>
          <CardFooter>
            <StatusDot state="running">Connected</StatusDot>
            <Button variant="ghost" size="sm" className="ml-auto">
              Open
            </Button>
          </CardFooter>
        </Card>
        <ThemePair className="md:grid-cols-1">
          <Card padded className="max-w-75">
            <div className="text-h4 font-semibold">Tonal depth</div>
            <p className="mt-1 text-sm text-fg-muted">A lit card on the canvas. No border shadow, in either theme.</p>
          </Card>
        </ThemePair>
      </Spec>

      <Spec
        id="codeblock"
        title="CodeBlock"
        meta="code-block.tsx"
        desc="A command a person copies. The card layout is 12.5px mono with a labelled Copy that reads Copied for a moment: two sit in Cards on Add host, and dim fades the trailing token without changing what is copied. The panel layout is the Add host dialog's: a tonal 10px panel at 11.5px with an icon-only copy in the corner that flips to a green check. Long lines wrap anywhere rather than breaking mid-token."
        code={`<CodeBlock title="Install command" code="curl -fsSL … --token opk_7f3a9c" dim="opk_7f3a9c" />
<CodeBlock layout="panel" code={installCommand} />`}
      >
        <div className="grid w-full gap-3 md:grid-cols-2">
          <Card padded>
            <CodeBlock
              title="Install command"
              code="curl -fsSL https://app.oppenheimer.dev/install.sh | sh -s -- --token opk_7f3a9c"
            />
          </Card>
          <Card padded>
            <CodeBlock
              title="Prompt for an AI agent"
              code={`Install the oppenheimer runner on this machine.\nRun: curl -fsSL https://app.oppenheimer.dev/install.sh | sh -s -- --token opk_7f3a9c`}
              dim="| sh -s -- --token opk_7f3a9c"
              note="Paste into Claude Code or Codex already running on that machine."
            />
          </Card>
        </div>
        <div className="w-full max-w-96">
          <CodeBlock
            layout="panel"
            code={`curl -fsSL https://app.oppenheimer.dev/install.sh \\\n  | sh -s -- --token opk_7f3a9c`}
          />
        </div>
      </Spec>

      <Spec
        id="summarycard"
        title="SummaryCard"
        meta="summary-card.tsx"
        desc="Facts a person checks before moving on: the Ready screen's workspace, code and host. A Card of rows with hairlines between them, a muted 13px label on the left and a mono value on the right. Values are mono because they are things, not prose."
        code={`<SummaryCard><SummaryRow label="Workspace">oppenheimer.dev/versio</SummaryRow>…</SummaryCard>`}
      >
        <SummaryCard className="w-full max-w-100">
          <SummaryRow label="Workspace">oppenheimer.dev/versio</SummaryRow>
          <SummaryRow label="Code">JordiParraCrespo · 12 repos</SummaryRow>
          <SummaryRow label="Host">mac-studio · macOS 15</SummaryRow>
        </SummaryCard>
      </Spec>

      <Spec
        id="successmark"
        title="SuccessMark"
        meta="success-mark.tsx"
        desc="The ring at the top of Ready: 52px, a 1.5px primary border on the selected tint, a primary check. It enters with a 320ms scale-and-fade and holds still under reduced motion. The one place the action blue is decorative, because the action is done."
        code={`<SuccessMark />`}
      >
        <Swatch label="md · 52">
          <SuccessMark />
        </Swatch>
        <Swatch label="sm · 36">
          <SuccessMark size="sm" />
        </Swatch>
        <div className="flex max-w-100 flex-col gap-3.5">
          <SuccessMark />
          <StepHeader title="You're all set">
            Versio Platform is ready. Start a session and watch every step it takes.
          </StepHeader>
        </div>
      </Spec>

      <Spec
        id="stepheader"
        title="StepHeader"
        meta="step-header.tsx"
        desc="The opening of every onboarding step: an eyebrow row with a Back link, a 12px hairline and the mono counter, then the 38px display title and the 15px muted lead. CreateWorkspace, ConnectGitHub and AddHost render it identically; Ready takes the title and lead alone."
        code={`<StepHeader step={2} total={4} back={{ href: '/sign-in' }} title="Name your workspace">A workspace holds your hosts, repositories and run history.</StepHeader>`}
      >
        <StepHeader
          className="max-w-100"
          step={2}
          total={4}
          back={{ href: '#stepheader' }}
          title="Name your workspace"
        >
          A workspace holds your hosts, repositories and run history. You can rename it later; the
          address is permanent.
        </StepHeader>
      </Spec>

      <Spec
        id="agentmark"
        title="AgentMark"
        meta="agent-mark.tsx"
        desc="The coding agent's mark at 15px. Claude Code carries Anthropic's mark in its own orange, Codex the OpenAI mark, OpenCode its square and Grok its slashed circle in the current ink, and Blank terminal a terminal glyph. An unknown id falls back to the bot."
        code={`<AgentMark agent="claude-code" />`}
      >
        {CODING_AGENT_IDS.map((agent) => (
          <Swatch key={agent} label={agent}>
            <span className="flex items-center gap-2.5 text-sm text-fg">
              <AgentMark agent={agent} />
              {CODING_AGENTS[agent].label}
            </span>
          </Swatch>
        ))}
      </Spec>

      <Spec
        id="emptystate"
        title="EmptyState"
        meta="empty-state.tsx"
        desc="An empty state names the next action. The full form has a title, a description and one button; compact is the left-aligned sidebar line."
        code={`<EmptyState compact><EmptyState.Header><EmptyState.Description>No sessions yet…</EmptyState.Description></EmptyState.Header></EmptyState>`}
      >
        <Card className="w-full max-w-105">
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <TerminalIcon />
              </EmptyState.Media>
              <EmptyState.Title>No sessions yet</EmptyState.Title>
              <EmptyState.Description>
                Sessions you start appear here with their live state and terminal.
              </EmptyState.Description>
            </EmptyState.Header>
            <EmptyState.Content>
              <Button>New session</Button>
            </EmptyState.Content>
          </EmptyState>
        </Card>
        <div className="w-60 rounded-lg border border-sidebar-border bg-sidebar">
          <EmptyState compact>
            <EmptyState.Header>
              <EmptyState.Description>
                No sessions yet. The one you start appears here with its live state.
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        </div>
      </Spec>

      <Spec
        id="skeleton"
        title="Skeleton"
        meta="skeleton.tsx"
        desc="Still loading: the shape of what is coming, on the off track, pulsing. Never a spinner in place of content that has a shape."
        code={`<Skeleton className="h-4 w-2/3" />`}
      >
        <SkeletonDemo />
      </Spec>

      <GroupHead>Forms</GroupHead>

      <Spec
        id="fields"
        title="Field · Input · PasswordInput"
        meta="field.tsx · input.tsx · password-input.tsx"
        desc="Anything you type into has a 10px radius. Field stacks a 13px medium label, the control and a 12px hint or error; FieldRow puts a Link beside the label. PasswordInput owns the reveal toggle once. Focus is the blue border plus a 3px ring; invalid turns both red."
        code={`<Field>
  <FieldRow><FieldLabel htmlFor="pw">Password</FieldLabel><FieldAction><Link href="/forgot">Forgot password?</Link></FieldAction></FieldRow>
  <PasswordInput id="pw" size="lg" />
  <FieldDescription>Twelve characters minimum.</FieldDescription>
</Field>`}
      >
        <FieldGroup className="w-full max-w-85">
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" size="lg" placeholder="you@company.com" />
          </Field>
          <Field>
            <FieldRow>
              <FieldLabel htmlFor="pw">Password</FieldLabel>
              <FieldAction>
                <Link href="#fields">Forgot password?</Link>
              </FieldAction>
            </FieldRow>
            <PasswordInput id="pw" size="lg" defaultValue="correct-horse-battery" />
            <FieldDescription>Twelve characters minimum.</FieldDescription>
          </Field>
          <Field data-invalid="true">
            <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
            <PasswordInput id="confirm" size="lg" aria-invalid defaultValue="horse" />
            <FieldError>Passwords do not match.</FieldError>
          </Field>
        </FieldGroup>
        <div className="flex w-full max-w-85 flex-col gap-3">
          <Input size="sm" placeholder="sm · 28" />
          <Input size="md" placeholder="md · 34" leading={<SearchIcon />} />
          <Input size="lg" placeholder="lg · 42" />
          <Input pill placeholder="Search sessions" leading={<SearchIcon />} trailing={<Kbd>⌘K</Kbd>} />
          <Input disabled placeholder="Disabled" />
        </div>
      </Spec>

      <Spec
        id="sluginput"
        title="SlugInput"
        meta="slug-input.tsx"
        desc="An Input for an address checked as you type, in the PasswordInput mould: it owns the mono prefix inside the border and the trailing verdict, which cycles through checking (a spinning ring), ok (a green check) and taken (a red ×, which also marks the field invalid). Pair with FieldDescription tone=success for the green hint. Type acme to see it taken."
        code={`<SlugInput size="lg" prefix="oppenheimer.dev/" status={status} {...register('slug')} />
<FieldDescription tone="success">oppenheimer.dev/versio is available.</FieldDescription>`}
      >
        <SlugFieldDemo />
      </Spec>

      <Spec
        id="segmented"
        title="SegmentedControl"
        meta="segmented-control.tsx"
        desc="Two or three ways to read the same thing, one always on: Command / Agent prompt in the Add host dialog. A pill on the hover surface with 2px of inset; the active segment lifts onto the card colour. Never a form value; that is RadioGroup. Three sizes: sm labels a panel, md (28px) switches what a pane shows (Briefing / Description / Changes, a lane), lg (32px) is a page's top row (Mine / Review requests / Watching); an item's count rides after its label in mono."
        code={`<SegmentedControl value={tab} onValueChange={setTab}><SegmentedControlItem value="cmd">Command</SegmentedControlItem>…</SegmentedControl>`}
      >
        <SegmentedDemo />
      </Spec>

      <Spec
        id="checkbox"
        title="Checkbox"
        meta="checkbox.tsx"
        desc="One tick, 18px at the 5px radius, filling with the accent when checked. The row in RepositoryRowList and FieldSelect, and on its own the one yes-or-no a dialog asks before an action it cannot undo: the Delete session dialog's discard of unpushed work. Wrap it in a FieldLabel so the words are the target too."
        code={`<FieldLabel className="flex items-center gap-2.5"><Checkbox checked={discard} onCheckedChange={setDiscard} /> Discard unpushed work</FieldLabel>`}
      >
        <CheckboxDemo />
      </Spec>

      <Spec
        id="radiogroup"
        title="RadioGroup"
        meta="radio-group.tsx"
        desc="One value out of a few, each a row that says what it does: the 16px ring filling with the action blue's dot, the label, an optional line under it. The whole row picks and the chosen one rests on the selected wash. A review's verdict in ReviewDecision. Two or three ways to read one pane are a SegmentedControl; a pick inside a menu is DropdownMenuRadioGroup."
        code={`<RadioGroup value={verdict} onValueChange={setVerdict} aria-label="Verdict"><RadioGroupItem value="approve" label="Approve" description="…" /></RadioGroup>`}
      >
        <RadioGroupDemo />
      </Spec>

      <Spec
        id="disclosure"
        title="Disclosure"
        meta="disclosure.tsx"
        desc="A fold inside a dialog or a step: one row that reads as a label, an optional word beside it, a summary on the right while closed, and a chevron that turns over 140ms. Add a host folds the install command and the agent prompt behind Inspect command and prompt, in the muted tone; the project dialog folds its Defaults with the summary of what is set."
        code={`<Disclosure><DisclosureTrigger meta="optional" summary="mac-studio · Claude Code">Defaults</DisclosureTrigger><DisclosurePanel>…</DisclosurePanel></Disclosure>`}
      >
        <DisclosureDemo />
      </Spec>

      <Spec
        id="textarea"
        title="Textarea"
        meta="textarea.tsx"
        desc="The multi-line field at the 10px radius, sized to its content from 88px."
        code={`<Textarea placeholder="Session name" />`}
      >
        <Field className="w-full max-w-105">
          <FieldLabel htmlFor="notes">Session name</FieldLabel>
          <Textarea id="notes" placeholder="Describe the task in one or two lines." />
        </Field>
      </Spec>

      <Spec
        id="chipselect"
        title="ChipSelect · RepositorySelect"
        meta="chip-select.tsx · repository-select.tsx"
        desc="A scope decision stated as a chip, so the row reads as a sentence: run on this host, this repo, this branch; the agent moved into the composer's engine button. Every one of them filters: a sticky search row, two-line options with a check and an optional mark, a centred line when nothing matches, and a pinned action band at the foot for adding what is not in the list yet. The repository picker multi-selects; each selected row grows a branch cell that opens a branch pane for that repo, and the branch chip only shows while exactly one repository is selected. An option that cannot be picked right now stays listed, faded, with the reason as its description: an offline host reads Offline · last seen 2 days ago."
        code={`<ChipSelect value={host} onValueChange={setHost} options={hosts} icon={<CpuIcon />} searchPlaceholder="Search hosts…" emptyText="No host matches." action={{ label: 'Add host…', onSelect: openAddHost }} />
<RepositorySelect repositories={repos} value={scope} onValueChange={setScope} />`}
      >
        <ScopeChips />
      </Spec>

      <Spec
        id="reporows"
        title="RepositoryAddField · RepositoryRowList"
        meta="repository-add-field.tsx · repository-row-list.tsx"
        desc="The project dialog's repositories, in two controls. RepositoryAddField decides which are in the project: a search field that reads Add a repository…, a listbox on focus of the repositories the App can see that are not yet added, and a 14px card of the ones added, each with an X. RepositoryRowList, in the Defaults fold under it, says what each does in a new session: a Cloned by default checkbox, the mono name and a 168px pill for the base branch, which opens the same searchable pane the scope chips use. Adding a repository adds it cloned by default on its own branch."
        code={`<RepositoryAddField repositories={repos} value={ids} onValueChange={setIds} />
<RepositoryRowList repositories={repos} value={rows} onValueChange={setRows} />`}
      >
        <RepositoryRowListDemo />
      </Spec>

      <Spec
        id="composer"
        title="Composer"
        meta="composer.tsx"
        desc="The prompt box: an 18px field with a growing textarea, then the foot row, which reads left to right as scope of action, then engine. Bottom left is what the run may touch: attachments and the permission level. Bottom right is who drives it and how hard it thinks: the agent and model, the effort, then mic and the round primary send. Enter submits, Shift+Enter breaks a line; while busy the send button becomes stop. On New session the composer is tabbed: the scope chips sit in a grey band fused to the top of the field, each a borderless ChipSelectTrigger in its tab variant, so host, repositories and branch read as one sentence over the box, which grows to 128px at 15px."
        code={`<Composer value={v} onValueChange={setV} onSubmit={start} onAttach={pick}
  scope={<><ChipSelect variant="tab" … /><RepositorySelect variant="tab" … /></>}
  tools={<PermissionMenu options={levels} value={level} onValueChange={setLevel} />}
  engine={<><AgentModelSelect agents={harnesses} value={engine} onValueChange={setEngine} /><EffortPicker stops={levels} value={effort} onValueChange={setEffort} /></>} />`}
      >
        <ComposerDemo />
        <ComposerDemo full />
        <ComposerDemo full blocked="fable is offline — pick another host" />
      </Spec>

      <Spec
        id="dropzone"
        title="DropZone"
        meta="drop-zone.tsx"
        desc="Files are attached by dropping them on the pane, not only through the paperclip. A drag that carries files outlines the whole pane in the action blue, 3px, square and flush with its edge: no fill, no radius, no label. In the console the zone wraps the main column beside the sidebar. On New session the files join the composer's attachments; in a running session each goes into the prompt as an @path. The outline exists only during the drag and never takes the pointer. The zone is its own box, so two on a page each get only their own drops; a box that owns the edge but not the drop draws DropOutline itself (the console's pane, which takes a framed page's drops); the window listener catches a near miss too, for a page with exactly one zone. A dragged link or text is left alone. Drag a file from your desktop onto either pane."
        code={`<DropZone onFiles={(files) => attach(files)}>
  <NewSessionPane />
</DropZone>
<DropZone listen="window" onFiles={attach}>…</DropZone>  // the page's only zone`}
      >
        <div className="grid w-full gap-4 lg:grid-cols-2">
          <DropZoneNewSessionDemo />
          <DropZoneTerminalDemo />
        </div>
      </Spec>

      <Spec
        id="datepicker"
        title="DatePicker"
        meta="date-picker.tsx"
        desc="A due date, or a day for an event. The trigger is a 34px field with the calendar glyph, the day as words and a chevron; it opens a small month with today ringed and the picked day filled in ink. Under the grid, quick picks as chips (the caller's words: Today, Tomorrow, Next Monday) and Clear while a day is set. Picking closes it. Days are plain ISO dates in the reader's calendar, and today is the caller's clock, never read in render."
        code={`<DatePicker
  value={due}
  onValueChange={setDue}
  today={today}
  quick={[{ label: 'Tomorrow', value: tomorrow }]}
/>`}
      >
        <DatePickerDemo />
      </Spec>

      <Spec
        id="engine"
        title="AgentModelSelect"
        meta="agent-model-select.tsx"
        desc="The engine button: the agent's mark and the model's name. Opening lands on the agent pane with the current harness checked; choosing one slides the same 252px popup to its models, with a back row, a search row and the check on the current model. Harness first, then its models, so the pair is always valid. A blank terminal has no models and is picked outright."
        code={`<AgentModelSelect agents={harnesses} value={{ agent: 'claude-code', model: 'claude-opus-5-5' }} onValueChange={setEngine} />`}
      >
        <AgentModelDemo />
      </Spec>

      <Spec
        id="effort"
        title="EffortSlider · EffortPicker"
        meta="effort-slider.tsx"
        desc="How long the agent may think, as a stepped track: one stop per level the caller passes (a model's own levels in the console), a 30px knob in full ink, the used part of the track in the control wash, a dot at every stop the knob is not on. Pointer picks and drags, arrows step. EffortPicker is the composer's form: a muted tool button opening a 268px popover with the Effort header, the info glyph and Faster / Smarter at the ends. Picking stays in the popover; you are comparing, not confirming."
        code={`<EffortPicker stops={levels} value={effort} onValueChange={setEffort} />
<EffortSlider stops={levels} value={effort} onValueChange={setEffort} />`}
      >
        <Swatch label="picker">
          <EffortDemo />
        </Swatch>
        <Swatch label="slider">
          <EffortDemo bare />
        </Swatch>
      </Spec>

      <Spec
        id="permission"
        title="PermissionMenu"
        meta="permission-menu.tsx"
        desc="What the agent may do on the host without asking: a muted tool button and three two-line options with their glyphs. Full access is the one level that can change a machine unattended, so it is the only one allowed the warning tone, on the button and on its row."
        code={`<PermissionMenu options={levels} value={level} onValueChange={setLevel} />`}
      >
        <Swatch label="approve for me">
          <PermissionDemo />
        </Swatch>
        <Swatch label="full access">
          <PermissionDemo initial="full" />
        </Swatch>
      </Spec>

      <Spec
        id="fieldselect"
        title="FieldSelect"
        meta="field-select.tsx"
        desc="A labelled picker whose value and a muted mono count sit on one line. It opens the same listbox as the chip select, with a search row, group eyebrows, and checkboxes when more than one can be picked. Two variants: the field, under a FieldLabel; and quiet, the value at the end of a FieldSelectRow, when several picks read as the rows of one FieldSelectGroup card."
        code={`<Field><FieldLabel>Repositories</FieldLabel><FieldSelect multiple value={repos} onValueChange={setRepos} options={options} /></Field>
<FieldSelectGroup><FieldSelectRow icon={<CpuIcon />} label="Host"><FieldSelect variant="quiet" value={host} onValueChange={setHost} options={hosts} /></FieldSelectRow></FieldSelectGroup>`}
      >
        <div className="flex w-full flex-col gap-6">
          <RoutineEditorDemo />
          <FieldSelectGroupDemo />
        </div>
      </Spec>

      <GroupHead>Overlays</GroupHead>

      <Spec
        id="callout"
        title="Callout"
        meta="callout.tsx"
        desc="A note in the flow, not a card: flat tonal fill, hairline-free, 13px text. It never outweighs the form it sits above, and it never carries a button; if an action is needed, the action lives in the form. Neutral is the default and carries no hue. The four tinted tones take a status hue at 11–14% behind full-opacity ink, and only when something actually is in that state."
        code={`<Callout tone="warning">This host has been unreachable for 6 minutes. Sessions on it are paused.</Callout>`}
      >
        <CalloutDemo />
      </Spec>

      <Spec
        id="alert"
        title="Alert"
        meta="alert.tsx"
        desc="The callout box with a title and, for a failure, its one action (Dismiss, Retry). A plain note is a Callout; a success is a toast."
        code={`<Alert tone="danger"><AlertTitle>Could not sign in</AlertTitle>…</Alert>`}
      >
        <AlertDemo />
      </Spec>

      <Spec
        id="dialog"
        title="Dialog"
        meta="dialog.tsx"
        desc="The one modal surface: 440px by default, 28px radius, the modal shadow, a blurred scrim, a 4px rise. The console's forms are dialogs over it: New project and Project settings at 540px, Add a host at 520px, the automation editor at 640px. Add a host opens from the composer's host chip: one sentence, Copy install command and Copy agent prompt, the token line, the command and the prompt behind an Inspect fold, and a status box that resolves in place. Destructive copy states the cost and the button says exactly what it does."
        code={`<Dialog><DialogTrigger render={<Button />}>Add a host…</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add a host</DialogTitle>…`}
      >
        <AddHostDialogDemo />
        <DestructiveDialogDemo />
      </Spec>

      <Spec
        id="dropdown"
        title="DropdownMenu"
        meta="dropdown-menu.tsx"
        desc="The popover tier: 14px radius, 14px rows, submenus for the filter facets. The console's menus share every part: filters with values; the account menu with its e-mail header, Appearance and Language as pane rows that slide the same menu to their options behind a back row, and a destructive Log out; the permission menu with icon rows and a warning tone."
        code={`<DropdownMenuPaneItem value="Match system" onClick={() => setPane('theme')}><MoonIcon /> Appearance</DropdownMenuPaneItem>
<DropdownMenuBack onClick={() => setPane('root')}>Appearance</DropdownMenuBack>`}
      >
        <Swatch label="filters">
          <FilterMenuDemo />
        </Swatch>
        <Swatch label="account, opens upward">
          <div className="rounded-md border border-sidebar-border bg-sidebar p-1">
            <AccountMenuDemo />
          </div>
        </Swatch>
      </Spec>

      <Spec
        id="command"
        title="Command"
        meta="command.tsx"
        desc="The command palette's parts: a search row over grouped rows, each with its icon tile and an optional shortcut. Every row filters as you type."
        code={`<Command><CommandInput placeholder="Search…" /><CommandList><CommandGroup heading="Actions"><CommandItem>…`}
      >
        <CommandDemo />
      </Spec>

      <Spec
        id="tooltip"
        title="Tooltip"
        meta="tooltip.tsx"
        desc="For icon-only controls. Inverted fill, 12px, 6px radius, no arrow, a 140ms fade."
        code={`<Tooltip><TooltipTrigger render={<IconButton aria-label="Filter" />}>…</TooltipTrigger><TooltipContent>Filter sessions</TooltipContent></Tooltip>`}
      >
        <TooltipDemo />
      </Spec>

      <Spec
        id="toast"
        title="Toast"
        meta="sonner.tsx"
        desc="A success is a toast, never an inline row or an Alert. Mount one Toaster per app; call toast.success() where the work finished."
        code={`toast.success('Host renamed')`}
      >
        <ToastDemo />
      </Spec>

      <GroupHead>Navigation</GroupHead>

      <Spec
        id="sidebar"
        title="Rail · Sidebar · SessionItem"
        meta="rail.tsx · sidebar.tsx · session-item.tsx"
        desc="The console's chrome. The 56px rail switches between the sessions and routines lists, its tooltips carrying the counts. The sidebar groups sessions under projects: a header per project with a folding chevron, a mono count and hover-only actions (new session here, project settings); search and the facet chips above the groups, and an empty group says so with a link. A session row is a glyph coloured by state and a name; the age shows on hover and on the active row, and gives way to the ellipsis, whose menu is Rename, Move to project… (a pane inside the menu) and Delete, each with its single-key hint. Rename turns the row into an inline input. A session still provisioning is pending: the grey glyph pulses. The rail's items and the sessions reorder by dragging, on one DragProvider for the shell: SortableRailItem in the rail's SortableGroup, and SortableSessionItem in a SortableGroup per project, so a session moves up or down in its project or into another one, the empty Client sites included. The projects reorder too: each is a SortableSidebarProjectGroup in a SortableGroup that takes projects, picked up by its header (a click still folds it, its actions never pick it up). Move to project… writes the same order. A click or Enter opens the item; a drag past 5px or Space picks it up. A search hides the rows it does not match and leaves the order whole. Drag Plan to the top, a session into Client sites, or Atlas above XRP Mobile."
        bare
      >
        <div className="flex flex-wrap gap-6">
          <div className="overflow-hidden rounded-lg border border-border-subtle">
            <SidebarDemo />
          </div>
          <div className="dark overflow-hidden rounded-lg border border-border-subtle">
            <SidebarDemo />
          </div>
          <div className="overflow-hidden rounded-lg border border-border-subtle">
            <SidebarDemo empty />
          </div>
        </div>
      </Spec>

      <Spec
        id="routineitem"
        title="RoutineItem"
        meta="routine-item.tsx"
        desc="The sidebar in routines mode: the same list holds routines. A clock or the GitHub mark names the trigger, the right edge carries the next run as a mono countdown, Running or Paused, behind a dot for how the last run ended (red failed, green running, grey otherwise). On hover the meta gives way to the ellipsis: Run now, Edit, Pause, Duplicate, Delete. A paused routine dims its name. Right: RoutineRun rows, the runs list the earlier frames expanded under the selected routine, kept while the console still draws it."
        code={`<RoutineItem name="Nightly dependency audit" meta="in 11m" lastRun="failed" lastRunLabel="Last run: failed" action={<DropdownMenu>…</DropdownMenu>} menuOpen={open} />`}
      >
        <RoutineItemsDemo />
      </Spec>

      <Spec
        id="pilltabs"
        title="PillTabs"
        meta="pill-tabs.tsx"
        desc="Switches views inside a page: Routines / Runs, the template categories, the run status. The selected tab takes a tonal fill, never a colour; counts ride inside the tab in mono. Two sizes: 32px for a page's top row, 28px inside a card."
        code={`<PillTabs value={view} onValueChange={setView}><PillTab value="runs" count={65}>Runs</PillTab></PillTabs>`}
      >
        <PillTabsDemo />
      </Spec>

      <Spec
        id="editorpage"
        title="EditorPage"
        meta="editor-page.tsx"
        desc="The frame of every console page — Plan, the automations, and the measure Add a host borrows inside Settings — and nothing in it. EditorPage is the column that scrolls on its own, on whatever ground it sits on (the console's pane paints the grey); EditorPageBody the measured body at a size, one per width the export repeats (status 420px and composer 720px centred in the pane; narrow 760px, wide 920px for a table, board 1240px for Plan's columns, fluid for a page as wide as the pane), with the gutter a data-bleed child reaches through; EditorPageBack the pill above the page header; EditorPageTop a first row for a page that opens on view tabs and one action. The console's shell draws the frame (the web kit's PageFrame) from the route's staticData.pane, so a page renders only its content."
        code={`<EditorPage><EditorPageBody><EditorPageBack render={<Link to="/sessions" />}>Back</EditorPageBack><PageHeader>…</PageHeader><RoutineSteps>…</RoutineSteps></EditorPageBody></EditorPage>
<EditorPage><EditorPageBody size="wide"><EditorPageTop><PillTabs …>…</PillTabs><Button size="sm" variant="secondary">New automation</Button></EditorPageTop>…</EditorPageBody></EditorPage>`}
      >
        <div className="flex w-full flex-col gap-6">
          <EditorPageDemo />
          <EditorPageWideDemo />
        </div>
      </Spec>

      <Spec
        id="pageheader"
        title="PageHeader"
        meta="page-header.tsx"
        desc="Every routine page opens with one: a breadcrumb back, the name beside its trigger glyph, actions on the right, and a meta line of facts. The title becomes an input when editing. A note band appears only when the state needs explaining. The display size is a page that opens on its own name (Plan's Tasks and Calendar): the ladder's H1, no glyph, and its facts under it as PageHeaderStats in an unindented meta line."
        code={`<PageHeader><PageHeaderCrumbs>…</PageHeaderCrumbs><PageHeaderRow icon={<ClockIcon />} title="Nightly dependency audit" actions={…} /><PageHeaderMeta>…</PageHeaderMeta><PageHeaderNote action={<Button size="sm">Resume</Button>}>Paused.</PageHeaderNote></PageHeader>`}
      >
        <PageHeaderDemo />
      </Spec>

      <Spec
        id="stepper"
        title="Stepper"
        meta="stepper.tsx"
        desc="The provisioning pane: the host as the eyebrow, Starting your session as the title, owner/repo · branch under it. Steps are named so a slow one is diagnosable: an empty ring while pending, a spinning ring while running, a green check when done, the rail turning green behind it, the running step's mono detail under its label, and the footer reading the elapsed seconds and a status word. A step that is slow for a reason the reader should know carries a note while it runs: the first clone of a repository on a host downloads it in full once."
        code={`<Stepper steps={[{ id, label, meta, note: firstClone ? 'First session on mac-studio with this repository…' : undefined, state: 'running' }]} elapsed="1.4s" status="Working…" />`}
      >
        <StepperDemo />
      </Spec>

      <GroupHead>Terminal</GroupHead>

      <Spec
        id="terminal"
        title="Terminal"
        meta="terminal.tsx"
        desc="The product's primary surface: 13px SF Mono at 1.55 on its own ramp, paper in light mode. In the product the scrollback is xterm.js; TerminalLine carries the same vocabulary for replays and the showcase. The prompt row is pinned and the status band runs along the bottom, starting with the link to the host: TerminalStatusLink is green and Live while connected, amber and pulsing while the console reconnects, amber and still once the host is offline."
        bare
      >
        <ThemePair className="md:grid-cols-1 lg:grid-cols-2 [&>div]:p-0 [&>div]:border-0 [&>div]:bg-transparent">
          <TerminalDemo />
        </ThemePair>
      </Spec>

      <Spec
        id="hostlink"
        title="HostLinkChrome · CommandRow"
        meta="host-link.tsx · command-row.tsx"
        desc="Where a session's link to its host stands, as one phase the Terminal is given: live, reconnecting, offline, catching up, reconnected. The terminal acts on it itself: the prompt locks and its placeholder says why, and behind the card the scrollback fades back. HostLinkChrome, in the status bar's place, draws the rest from the same phase table. The banner is the console's form: the bar's place goes to an amber wash with the dot, “optimus is offline”, a dim line and the time offline, and its one control, How to fix, opens the fix above it. The notice is the frames' other drawing of the same phases, a card over the scrollback. The session comes back on its own (the runner dials out), so the fix is the only control. The fix is CommandRows, a $ command with an icon copy button (Copy command, then Copied), and a link to Settings → Hosts. Step through the phases with the control above each terminal."
        code={`<Terminal hostLink={{ phase, host: 'optimus' }}>
  <TerminalScrollback>…</TerminalScrollback>
  <TerminalPrompt />
  <HostLinkChrome elapsed="2m 14s" fix={<><CommandRowList><CommandRow surface="terminal" lead="To see what went wrong:" command="…" /></CommandRowList><Link to="/settings/hosts">Settings → Hosts</Link></>}>
    <TerminalStatusItem>1 host</TerminalStatusItem>
  </HostLinkChrome>
</Terminal>
<Terminal hostLink={{ phase, form: 'notice', host: 'optimus' }}>…</Terminal>`}
        bare
      >
        <div className="flex w-full flex-col gap-6">
          <ThemePair className="md:grid-cols-1 lg:grid-cols-2 [&>div]:p-0 [&>div]:border-0 [&>div]:bg-transparent">
            <TerminalHostLinkDemo form="banner" />
          </ThemePair>
          <ThemePair className="md:grid-cols-1 lg:grid-cols-2 [&>div]:p-0 [&>div]:border-0 [&>div]:bg-transparent">
            <TerminalHostLinkDemo form="notice" />
          </ThemePair>
        </div>
      </Spec>

      <Spec
        id="sessionpane"
        title="SessionPaneHeader"
        meta="session-pane-header.tsx"
        desc="The bar over a session's terminal, on the pane's card with a hairline under it: the session in mono, its run state on StatusDot, and on the right what drives it (agent, model, repository) in small mono. A session opened from a task leads with the way back to it, a quiet link with the task's title and a slash, no glyph. TerminalStatusBar is the terminal's own band along its bottom."
        code={`<SessionPaneHeader
  state="needs-input"
  name="biometric-unlock"
  stateLabel="Needs input"
  meta="claude-code · opus 4.6 · xrp-mobile"
  back={<SessionPaneBack render={<RouterLink to="/plan/tasks/$id" params={{ id }} />}>Biometric unlock on Android</SessionPaneBack>}
/>`}
      >
        <SessionPaneHeaderDemo />
      </Spec>

      <GroupHead>Routines</GroupHead>

      <Spec
        id="runhistory"
        title="RunHistory"
        meta="run-history.tsx"
        desc="One column per day. Height is successful runs; a red dot above means at least one failed. Empty days keep a 3px stub so the time axis never compresses. Hovering a column dims the rest. The header carries the legend, or a link when the counts live elsewhere."
        code={`<RunHistory days={days} axis={['27 Aug', '26 Sep']} />`}
      >
        <RunHistoryDemo />
      </Spec>

      <Spec
        id="routinetable"
        title="RoutineTable"
        meta="routine-table.tsx"
        desc="The Routines overview. The trigger reads in words, the next run gives both clock time and a relative countdown, the status is a dot and a word, and the row actions stay behind the ellipsis. Paused rows dim."
        code={`<RoutineTable><RoutineTableHead /><RoutineTableRow icon={<ClockIcon />} name="Nightly dependency audit" sub="XRP Mobile · Claude Code" trigger="Every weekday at 09:00" next="Mon 09:00" nextRelative="in 2d 14h" status="active" statusLabel="Active" action={…} /></RoutineTable>`}
      >
        <RoutineTableDemo />
      </Spec>

      <Spec
        id="runslist"
        title="RunsList"
        meta="runs-list.tsx"
        desc="The Runs tab: status tabs with counts and the facet tokens in the filter row, then a row per run with its routine and time. Step-level glyphs (check circle, alert circle) are allowed here because each row is a finished run, not a live state; a run still going shows the pulsing dot."
        code={`<RunsList><RunsListFilters>…</RunsListFilters><RunsListHead /><RunRow state="failed" title="Dependency audit · 3 safe bumps" routine="Nightly dependency audit" date="Sep 26" time="02:00" /><RunsListFoot range="1–10 of 65" onNext={next} /></RunsList>`}
      >
        <RunsListDemo />
      </Spec>

      <Spec
        id="templates"
        title="TemplateGrid"
        meta="template-grid.tsx"
        desc="Starting points under the routine table, filtered by category tabs. Each names its trigger in the meta line; Add opens the editor prefilled."
        code={`<TemplateGrid><TemplateItem icon={<GitPullRequestIcon />} name="Pull request review" description="…" meta={<>…On pull request opened</>} action={<Button size="sm">Add</Button>} /></TemplateGrid>`}
      >
        <TemplateGridDemo />
      </Spec>

      <Spec
        id="routinesteps"
        title="RoutineSteps · InlineToken · TimeGrid"
        meta="routine-steps.tsx · inline-token.tsx · time-grid.tsx"
        desc="The routine editor is four numbered steps: Where, When, What, Agent. A finished step inverts its number to a tick and prints a one-line summary on the right, so the whole routine reads top to bottom before you save. A trigger reads as a sentence and every variable part is a token you click to change; mono tokens hold values a human compares. The time token opens a grid of hours where past times are disabled rather than hidden. A weekly schedule previews its days as a strip with the next one ringed; a GitHub event previews what it would have matched. The dashed row adds another trigger."
        code={`<RoutineSteps><RoutineStep number={2} title="When" subtitle="Any trigger starts a run." done summary="Weekdays at 09:00"><TriggerCard icon={<ClockIcon />} onRemove={remove} preview={…}><TokenSentence>Every <InlineToken>weekday</InlineToken> at <InlineToken mono>09:00</InlineToken></TokenSentence></TriggerCard><AddRow>Add another trigger</AddRow></RoutineStep></RoutineSteps>`}
      >
        <RoutineEditorDemo />
      </Spec>

      <GroupHead>Plan</GroupHead>

      <Spec
        id="drag"
        title="Drag layer"
        meta="drag.tsx"
        desc="Headless primitives any surface composes to move things by dragging, built on dnd-kit and wrapped so apps only import these names. DragProvider owns one surface's drag: pointer and keyboard (space to pick up, arrows, space to drop, escape to cancel), scrolling at the edges and what a screen reader hears, in words the caller translates. useDraggable and useDroppable make anything a source or a target, and accepts limits a target to the types it takes. SortableGroup and SortableItem keep things in order across one or more groups: the item's own place becomes the drop slot, its neighbours slide out of the way, and useSortableGroups moves ids between groups as the drag crosses them. The motion is the frames' on the system's ramp: a press becomes a drag after 5px, the lifted copy takes --drag-lift and the popover shadow over the fast duration, neighbours slide on the base duration and the copy glides home on the same as it settles flat. One DragProvider per surface, owned by the page; a component that drags (the month) draws its sources and targets inside it. Reduced motion keeps the moves and drops the motion. Files from the desktop are DropZone's, not this layer's."
        code={`const sortable = useSortableGroups(groups, setGroups, save);
<DragProvider {...sortable} overlay={(active) => <Card id={active.id} />}>
  <SortableGroup id="todo" items={groups.todo}>
    {groups.todo.map((id) => <SortableItem key={id} id={id} data={{ type: 'task', label: titleOf(id) }}><Card id={id} /></SortableItem>)}
  </SortableGroup>
</DragProvider>

const drop = useDroppable({ id: day, accepts: ['task'] });   // drop.isOver, drop.canDrop
const drag = useDraggable({ id, data: { type: 'task' } });    // drag.handleProps`}
      >
        <DragPrimitivesDemo />
      </Spec>

      <Spec
        id="taskboard"
        title="TaskBoard · GoalCard"
        meta="task-board.tsx · goal-card.tsx · page-header.tsx"
        desc="Plan's tasks by status, on the drag layer. A column is a SortableGroup with its head (the status on StatusDot, the count in mono, a + to add) over an 18px tray on the hover wash that tints toward the selected wash while a card would land in it; its foot is Add task or the composer. A card has a round Checkbox (green when done, the title struck), the title, two lines of notes, the project and goal, the due date in mono (red when overdue, full ink when due within a day), the linked session as a chip that opens it, and Start session on hover. The board is one row of however many columns it is given, as wide as its parent. A task's status reads on the run-state dots (TASK_STATUS_STATE: Later pending, To do idle, In progress running, Done completed). Goals sit above the board: a 4px bar of the share done, full ink and green at 100%, and the goal's name is a toggle that narrows the board, its menu beside it. The page opens on PageHeaderRow at its display size. Drag cards within and across columns, check one off, add one, pick a goal."
        code={`<DragProvider {...useSortableGroups(groups, setGroups, save)} overlay={(a) => <TaskCard title={titleOf(a.id)} />}>
  <TaskBoard>
    <TaskColumn id="todo" status="todo" label="To do" count={4} items={groups.todo} onAdd={add} foot={<TaskColumnAdd onClick={add}>Add task</TaskColumnAdd>}>
      {groups.todo.map((id) => (
        <SortableItem key={id} id={id} data={{ type: 'task' }}>
          <TaskCard title="Draft the beta waitlist email" project="Atlas" due="Oct 10" session={<TaskSessionChip state="running" word="Running" name="atlas-waitlist" />} onStart={start} />
        </SortableItem>
      ))}
    </TaskColumn>
  </TaskBoard>
</DragProvider>
<GoalCard name="Atlas public beta" meta="Atlas · Nov 16" done={1} total={4} countLabel="1 / 4 tasks" selected onSelect={pick} />`}
        bare
      >
        <div className="flex w-full flex-col gap-6">
          <TaskStatusDots />
          <TaskBoardDemo />
        </div>
      </Spec>

      <Spec
        id="calendar"
        title="MonthCalendar · CalendarSourceCard"
        meta="month-calendar.tsx · calendar-source.tsx"
        desc="Plan's month: weekday eyebrows over whole weeks, Monday first. Days outside the month sit on the hover wash with their entries faded, today's number is a filled circle, and the 1st reads Oct 1. Entries are a ring for a timed event, a check for a task's due date and a bolt for an automation run, with the time in mono; an all-day event is a filled bar and a free one reads muted. Past four a day shows three and N more, which opens the whole day. Drag an event or a task to another day: it lifts, the day under it takes the selected wash, and escape puts it back. The page owns the DragProvider: an entry is a calendar-entry source and a day a target whose id is its date, and N more lists the day to read, not to drag. Automation runs keep their schedule. It shares one month grid with DatePicker. The sidebar lists what the month draws, each source a row with a Checkbox, and the connected calendar's card says when it last synced."
        code={`<DragProvider overlay={(a) => <CalendarEntry entry={byId(a.id)} lifted />} onDragEnd={({ active, over }) => over && move(active.id, over.id)}>
  <MonthCalendar year={2026} month={9} today={today} entries={entries} onOpenEntry={open} onAddDay={add} />
</DragProvider>
<CalendarLayerItem icon={<CalendarIcon />} checked onCheckedChange={toggle}>Google Calendar</CalendarLayerItem>
<CalendarSourceCard mark={<BrandGlyph name="google" />} name="Google Calendar" account="me@example.com" status="Synced 2 min ago" />`}
        bare
      >
        <MonthCalendarDemo />
      </Spec>

      <Spec
        id="plandialogs"
        title="Task & session dialogs"
        meta="dialog.tsx · chip.tsx · chip-select.tsx · date-picker.tsx"
        desc="The task dialog and Start session are compositions, not components: a form-size Dialog with a borderless title and notes, then label and value rows. Values that are fixed (the four statuses, an agent's models) are chips; values that grow with the workspace (projects, goals, hosts, repositories) are ChipSelects that filter. One state each: what a pick means (an offline host, a queued start) is the console's rule, not this page's."
      >
        <PlanDialogsDemo />
      </Spec>

      <GroupHead>Pull requests</GroupHead>

      <Spec
        id="prqueue"
        title="PullRequestTable"
        meta="pull-request-table.tsx"
        desc="The queue of pull requests waiting on the reader, on the card. A row is its lane as a Badge (strong for Deep, soft for Medium and Quick), the title with repo #number in mono and who opened it (a session's bot glyph or a person's), a note when something holds it, the size as a DiffStat, checks and conflicts as StatusDot gate states (passing, blocked, waiting) and a word, the wait in mono (full ink once it is late), and the actions. The title is the row's button, stretched over it, so the actions are never inside it. The table reads its own width: from 880px Size, Checks and Conflicts are columns, narrower they fold under the title. MergeButton asks once in place (Cancel, Confirm merge) and says why it is off while checks, conflicts or a code owner hold it. The page opens on PageHeaderRow display with Review next, the scopes are a large SegmentedControl with counts, the filters are a search and PillTabs, the foot is RunsListFoot."
        code={`<PullRequestTable>
  <PullRequestTableHead />
  <PullRequestRow lane={<Badge variant="strong">Deep</Badge>} title="Move session tokens to the runner keychain" reference="oppenheimer #482" author="Session · auth-hardening" additions={612} deletions={248} checks="passing" checksLabel="Passing" conflicts="passing" conflictsLabel="No conflicts" waiting="1d 3h" onOpen={open}
    actions={<MergeButton confirming={confirming} onConfirmingChange={setConfirming} onMerge={merge} />} />
</PullRequestTable>`}
        bare
      >
        <PullRequestQueueDemo />
      </Spec>

      <Spec
        id="prbriefing"
        title="Briefing · ReviewDecision"
        meta="pull-request-header.tsx · stat-card.tsx · merge-path.tsx · panel.tsx · review-decision.tsx · prose.tsx"
        desc="One pull request, opened on its briefing. The bar holds the views (a medium SegmentedControl, Changes carrying its DiffStat), Open review session and Submit review, which opens ReviewDecision in a popover: the verdicts as a RadioGroup, the optional comment (the same field a diff's draft uses: ⌘↵ submits, Esc closes), what posts with it, Discard, and the primary named for the verdict. PullRequestHeader is the state (a StatusDot pill), lane and reference, the title at H2 and the branch head → base. StatCards lead with the numbers (a 24px mono figure, a unit, a StatBar of shares or a track); MergePath is a horizontal Stepper of Checks, Conflicts, Review and Merge (a gate not met is failed), with the next step and its actions under a hairline. StatCard and Panel are Cards. The rest are Panels: the brief with its FactTiles and lane, the review session, the pending comments as DiffCommentLinks, where it changes, the reviewers. Description renders the author's markdown in Prose. The second frame is the same page held by a conflict."
        code={`<PullRequestHeader state="active" stateLabel="Open" lane={<Badge variant="strong">Deep</Badge>} reference="oppenheimer #482" title="…" author="Session · auth-hardening" head="agent/auth-keychain" base="main" />
<StatCard label="Checks" value="214 / 214" unit="Passing" bar={<StatBar track segments={[{ share: 100, tone: 'success' }]} />} />
<MergePath title="Path to merge" summary="2 of 4 done" steps={[{ id: 'checks', label: 'Checks', detail: 'All passing', state: 'done' }, …]} note="Squash and merge into main" actions={…} />
<Popover><PopoverTrigger render={<SubmitReviewButton count={2} />}>Submit review</PopoverTrigger><PopoverContent align="end"><ReviewDecision verdicts={…} verdict={v} onVerdictChange={setV} comment={c} onCommentChange={setC} submitLabel="Approve and merge" onSubmit={submit} /></PopoverContent></Popover>`}
        bare
      >
        <PullRequestBriefingDemo />
      </Spec>

      <Spec
        id="diffview"
        title="DiffView · DiffFileTree"
        meta="diff-view.tsx · diff-file-tree.tsx · file-icon.tsx · diff-stat.tsx"
        desc="A pull request's Changes on @pierre/diffs, the library DiffsHub runs on: Shiki highlighting, unified or split, long lines wrapped, hunks under their @@ line. A file is a DiffFile: its sticky header (fold chevron, the file's type mark, the path with its folder muted, comments, the DiffStat, Viewed) over its lines. Comments are annotations on one side of one line, drawn as a DiffComment (the review agent's bot glyph or a person's avatar) or a DiffCommentDraft; hovering a line number offers the blue + that starts one. Beside it, DiffFileTree on @pierre/trees: single-child folders flattened, each file's mark and DiffStat, a filter, and how many are viewed. The diff takes the app's theme as colorScheme rather than reading the OS. The marks are the trees' published icon set, which FileIcon draws anywhere else."
        code={`<DiffFile>
  <DiffFileHeader path={file.path} additions={318} deletions={40} comments={1} collapsed={collapsed} onCollapsedChange={setCollapsed} viewed={viewed} onViewedChange={setViewed} />
  <DiffView patch={file.patch} layout="unified" colorScheme={theme} annotations={notes} onCommentLine={openDraft} renderAnnotation={({ metadata }) => <DiffComment bot author="Full-review agent" status="Pending">{metadata.text}</DiffComment>} />
</DiffFile>
<DiffFileTree files={files} selected={path} onSelect={scrollTo} viewed={1} />`}
        bare
      >
        <DiffDemo />
      </Spec>

      <Spec
        id="pranalytics"
        title="Charts"
        meta="charts.tsx"
        desc="The review analytics, in HTML and SVG on the chart tokens: blue, teal and violet, validated as a categorical order for colour-blind separation in both themes. ChartHero is a series' headline figure at 40px mono with its StatDelta. BarChart groups a day's columns (16px at most, 3px apart), labels the days in mono with the month under its first day, and on hover lifts the day, fades the rest and reads its values out above. LineChart draws two series with a crosshair, a dot per series and ticks on the right. RingChart shows shares of a whole with rounded, gapped arcs and the total inside; ChartRow is its legend row. BarList ranks reasons on a share bar with the previous value. Values sit in text ink, never the series colour, and every multi-series chart has a ChartLegend."
        code={`<BarChart series={[{ key: 'created', label: 'Created', tone: 'chart-1' }, { key: 'merged', label: 'Merged', tone: 'chart-2' }]} data={days} aria-label="Pull requests per day" />
<LineChart series={series} points={weeks} ticks={[0, 1, 2, 3, 4]} format={(h) => \`\${h}h\`} aria-label="Median wait" />
<RingChart label="Merged" value={214} segments={[{ key: 'quick', label: 'Quick', value: 118, tone: 'chart-1' }, …]} />`}
        bare
      >
        <PullRequestAnalyticsDemo />
      </Spec>

      <GroupHead>Settings</GroupHead>

      <Spec
        id="settingsshell"
        title="SettingsShell"
        meta="settings-shell.tsx"
        desc="The Settings pages' frame and nothing in it. SettingsShell is the row: SettingsNav on the left, SettingsMain the column on the canvas that scrolls on its own, SettingsContent the measured column inside it with its sections spaced, SettingsTitle how a section opens — the h2 stop, a muted line, one action on the right. The console mounts the frame once from the /settings layout route and each section fills the column."
        code={`<SettingsShell><SettingsNav>…</SettingsNav><SettingsMain><SettingsContent><SettingsTitle title="Hosts" description="…" action={<Button>Add host</Button>} />…</SettingsContent></SettingsMain></SettingsShell>`}
      >
        <SettingsShellDemo />
      </Spec>

      <Spec
        id="settingsnav"
        title="SettingsNav"
        meta="settings-nav.tsx"
        desc="A plain sidebar: a way back to the console, then eyebrow-labelled groups. Counts ride on the right in mono."
        code={`<SettingsNav><SettingsNavBack>Back to console</SettingsNavBack><SettingsNavGroup label="Workspace"><SettingsNavItem icon={<CpuIcon />} count={3} active>Hosts</SettingsNavItem></SettingsNavGroup></SettingsNav>`}
      >
        <SettingsNavDemo />
      </Spec>

      <Spec
        id="settingsgroup"
        title="SettingsGroup"
        meta="settings-group.tsx"
        desc="One card per group, one row per setting: label and a one-line hint on the left, the control on the right, hairlines between. A save row appears at the foot only when something changed. The destructive group is its own card under a heading."
        code={`<SettingsGroup><SettingsRow label="Full name"><Input … /></SettingsRow><SettingsSaveRow><Button variant="ghost" size="sm">Discard</Button><Button size="sm">Save changes</Button></SettingsSaveRow></SettingsGroup>`}
      >
        <SettingsGroupDemo />
      </Spec>

      <Spec
        id="hostcard"
        title="HostCard"
        meta="host-card.tsx"
        desc="One card per host. Running is green, idle is a grey dot, offline is a hollow ring with its last-seen time. The ellipsis holds Rename, Copy host ID (with the id as a mono value) and Remove host. An offline host opens its detail under a hairline: what waits on it (sessions that reconnect on their own, automation runs queued, a runner out of date), the commands that bring it back as CommandRows, and Check again with a mono note of the answer. The console cannot reconnect a runner, so the card explains and looks again."
        code={`<HostCard name="fable" status="offline" state="Offline" seen="last seen 2 days ago" action={…}
  offline={{ note: '3 sessions reconnect on their own…', commands: [{ lead: 'To see what went wrong:', command: '…' }], action: <Button variant="secondary" size="sm">Check again</Button>, actionNote: 'still offline · checked just now' }} />`}
      >
        <HostCardsDemo />
      </Spec>

      <GroupHead>Media</GroupHead>

      <Spec
        id="carousel"
        title="ImageCarousel"
        meta="image-carousel.tsx"
        desc="The photo panel beside the auth forms: 28px frame, slides cross-fading every 5.2s, a caption per slide, pill dots that jump. Pauses on hover and stops under reduced motion. The caption scrim is the system's one sanctioned gradient."
        code={`<ImageCarousel slides={[{ src, alt, caption, position: '50% 22%' }]} />`}
      >
        <CarouselDemo />
      </Spec>
    </PageShell>
  );
}
