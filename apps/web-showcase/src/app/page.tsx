'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@oppenheimer/design-system-web/avatar';
import { BrandGlyph } from '@oppenheimer/design-system-web/brand-glyph';
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
} from 'lucide-react';
import {
  AccountMenuDemo,
  CarouselDemo,
  ComposerDemo,
  AddHostDialogDemo,
  DestructiveDialogDemo,
  SegmentedDemo,
  SlugFieldDemo,
  FilterMenuDemo,
  AgentModelDemo,
  EffortDemo,
  PermissionDemo,
  ScopeChips,
  SidebarDemo,
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

      {/* ── Foundations ─────────────────────────────────────────────────── */}
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

      {/* ── Core ─────────────────────────────────────────────────────────── */}
      <GroupHead>Core</GroupHead>

      <Spec
        id="wordmark"
        title="Wordmark"
        meta="wordmark.tsx"
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
      </Spec>

      <Spec
        id="buttons"
        title="Button"
        meta="button.tsx"
        desc="Anything you press is a pill, on the 28 / 34 / 42 ramp. One primary per view. Press is a scale to .975, never a hue change. Disabled keeps its shape at 40%. It acts; a Link navigates."
        code={`<Button size="lg" block>Sign in</Button>
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
            <BrandGlyph name="github" flip={false} className="text-white" /> Connect GitHub
          </Button>
        </Swatch>
        <div className="flex w-full max-w-[340px] flex-col gap-2.5">
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
        <div className="w-full max-w-[340px]">
          <Separator>or</Separator>
        </div>
        <div className="w-full max-w-[340px]">
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
        <Card className="w-full max-w-[360px]">
          <CardHeader>
            <CardTitle>mac-studio</CardTitle>
            <CardDescription>macOS 15 · echo 38 ms · 3 sessions</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Chip icon={<CheckIcon className="text-success" strokeWidth={2.5} />}>git</Chip>
            <Chip icon={<CheckIcon className="text-success" strokeWidth={2.5} />}>tmux</Chip>
            <Chip icon={<CheckIcon className="text-success" strokeWidth={2.5} />}>claude</Chip>
          </CardContent>
          <CardFooter>
            <StatusDot state="running">Connected</StatusDot>
            <Button variant="ghost" size="sm" className="ml-auto">
              Open
            </Button>
          </CardFooter>
        </Card>
        <ThemePair className="md:grid-cols-1">
          <Card padded className="max-w-[300px]">
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
        <div className="w-full max-w-[384px]">
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
        <SummaryCard className="w-full max-w-[400px]">
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
        <div className="flex max-w-[400px] flex-col gap-3.5">
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
          className="max-w-[400px]"
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
        desc="The coding agent's mark at 15px. Claude Code carries Anthropic's mark in its own orange, OpenCode its square in the current ink. Codex takes the neutral bot glyph on purpose, since no OpenAI mark ships with this system, and Blank terminal a terminal glyph. An unknown id falls back to the bot."
        code={`<AgentMark agent="claude-code" />`}
      >
        {(['claude-code', 'codex', 'opencode', 'shell'] as const).map((agent) => (
          <Swatch key={agent} label={agent}>
            <span className="flex items-center gap-2.5 text-[13px] text-fg">
              <AgentMark agent={agent} />
              {agent === 'claude-code'
                ? 'Claude Code'
                : agent === 'codex'
                  ? 'Codex'
                  : agent === 'opencode'
                    ? 'OpenCode'
                    : 'Blank terminal'}
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
        <Card className="w-full max-w-[420px]">
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

      {/* ── Forms ────────────────────────────────────────────────────────── */}
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
        <FieldGroup className="w-full max-w-[340px]">
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
        <div className="flex w-full max-w-[340px] flex-col gap-3">
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
        desc="Two or three ways to read the same thing, one always on: Command / Agent prompt in the Add host dialog. A pill on the hover surface with 2px of inset; the active segment lifts onto the card colour. Never a form value; that is RadioGroup."
        code={`<SegmentedControl value={tab} onValueChange={setTab}><SegmentedControlItem value="cmd">Command</SegmentedControlItem>…</SegmentedControl>`}
      >
        <SegmentedDemo />
      </Spec>

      <Spec
        id="textarea"
        title="Textarea"
        meta="textarea.tsx"
        desc="The multi-line field at the 10px radius, sized to its content from 88px."
        code={`<Textarea placeholder="Session name" />`}
      >
        <Field className="w-full max-w-[420px]">
          <FieldLabel htmlFor="notes">Session name</FieldLabel>
          <Textarea id="notes" placeholder="Describe the task in one or two lines." />
        </Field>
      </Spec>

      <Spec
        id="chipselect"
        title="ChipSelect · RepositorySelect"
        meta="chip-select.tsx · repository-select.tsx"
        desc="A scope decision stated as a chip, so the row reads as a sentence: run on this host, this repo, this branch; the agent moved into the composer's engine button. Every one of them filters: a sticky search row, two-line options with a check and an optional mark, a centred line when nothing matches, and a pinned action band at the foot for adding what is not in the list yet. The repository picker multi-selects; each selected row grows a branch cell that opens a branch pane for that repo, and the branch chip only shows while exactly one repository is selected."
        code={`<ChipSelect value={host} onValueChange={setHost} options={hosts} icon={<CpuIcon />} searchPlaceholder="Search hosts…" emptyText="No host matches." action={{ label: 'Add host…', onSelect: openAddHost }} />
<RepositorySelect repositories={repos} value={scope} onValueChange={setScope} />`}
      >
        <ScopeChips />
      </Spec>

      <Spec
        id="composer"
        title="Composer"
        meta="composer.tsx"
        desc="The prompt box: an 18px field with a growing textarea, then the foot row, which reads left to right as scope of action, then engine. Bottom left is what the run may touch: attachments and the permission level. Bottom right is who drives it and how hard it thinks: the agent and model, the effort, then mic and the round primary send. Enter submits, Shift+Enter breaks a line; while busy the send button becomes stop."
        code={`<Composer value={v} onValueChange={setV} onSubmit={start} onAttach={pick}
  tools={<PermissionMenu options={levels} value={level} onValueChange={setLevel} />}
  engine={<><AgentModelSelect agents={harnesses} value={engine} onValueChange={setEngine} /><EffortPicker value={effort} onValueChange={setEffort} /></>} />`}
      >
        <ComposerDemo />
        <ComposerDemo full />
      </Spec>

      <Spec
        id="engine"
        title="AgentModelSelect"
        meta="agent-model-select.tsx"
        desc="The engine button: the agent's mark and the model's name. Opening lands on the agent pane with the current harness checked; choosing one slides the same 252px popup to its models, with a back row, a search row and the check on the current model. Harness first, then its models, so the pair is always valid. A blank terminal has no models and is picked outright."
        code={`<AgentModelSelect agents={harnesses} value={{ agent: 'claude-code', model: 'claude-opus-5' }} onValueChange={setEngine} />`}
      >
        <AgentModelDemo />
      </Spec>

      <Spec
        id="effort"
        title="EffortSlider · EffortPicker"
        meta="effort-slider.tsx"
        desc="How long the agent may think, as a stepped track: five stops from Minimal to Max, a 30px knob in full ink, the used part of the track in the control wash, a dot at every stop the knob is not on. Pointer picks and drags, arrows step. EffortPicker is the composer's form: a muted tool button opening a 268px popover with the Effort header, the info glyph and Faster / Smarter at the ends. Picking stays in the popover; you are comparing, not confirming."
        code={`<EffortPicker value={effort} onValueChange={setEffort} />
<EffortSlider value={effort} onValueChange={setEffort} />`}
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

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      <GroupHead>Overlays</GroupHead>

      <Spec
        id="dialog"
        title="Dialog"
        meta="dialog.tsx"
        desc="The one modal surface: 440px, 28px radius, the modal shadow, a blurred scrim, a 4px rise. Add host is the only dialog in v1: one instruction, two ways to read it, and a status line that resolves in place so nothing below it moves. Destructive copy states the cost and the button says exactly what it does."
        code={`<Dialog><DialogTrigger render={<Button />}>Add a host…</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add a host</DialogTitle>…`}
      >
        <AddHostDialogDemo />
        <DestructiveDialogDemo />
      </Spec>

      <Spec
        id="dropdown"
        title="DropdownMenu"
        meta="dropdown-menu.tsx"
        desc="The popover tier: 14px radius, 14px rows, submenus for facets. The console's menus share every part: filters with values, the account menu with its e-mail header and destructive Log out, the permission menu with icon rows and a warning tone."
        code={`<DropdownMenuSubTrigger>Repository <DropdownMenuValue>All repositories</DropdownMenuValue></DropdownMenuSubTrigger>`}
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
        id="tooltip"
        title="Tooltip"
        meta="tooltip.tsx"
        desc="For icon-only controls. Inverted fill, 12px, 6px radius, no arrow, a 140ms fade."
        code={`<Tooltip><TooltipTrigger render={<IconButton aria-label="Filter" />}>…</TooltipTrigger><TooltipContent>Filter sessions</TooltipContent></Tooltip>`}
      >
        <TooltipDemo />
      </Spec>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <GroupHead>Navigation</GroupHead>

      <Spec
        id="sidebar"
        title="Sidebar · SessionItem"
        meta="sidebar.tsx · session-item.tsx"
        desc="The 264px rail on its own surface tier: wordmark, the New session button, an eyebrow header with count and filter, the session list, and the account footer. A session row is a glyph coloured by state and a name; the age appears on hover and on the active row. A session still provisioning is pending: the grey glyph pulses."
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
        id="stepper"
        title="Stepper"
        meta="stepper.tsx"
        desc="The provisioning pane. Steps are named so a slow one is diagnosable: a spinning ring while running, a green check when done, the rail turning green behind it, mono elapsed time in the footer."
        code={`<Stepper steps={[{ id, label, meta, state: 'running' }]} elapsed="00:12" status="Provisioning" />`}
      >
        <StepperDemo />
      </Spec>

      {/* ── Terminal ─────────────────────────────────────────────────────── */}
      <GroupHead>Terminal</GroupHead>

      <Spec
        id="terminal"
        title="Terminal"
        meta="terminal.tsx"
        desc="The product's primary surface: 13px SF Mono at 1.55 on its own ramp, paper in light mode. In the product the scrollback is xterm.js; TerminalLine carries the same vocabulary for replays and the showcase. The prompt row is pinned and the status band runs along the bottom."
        bare
      >
        <ThemePair className="md:grid-cols-1 lg:grid-cols-2 [&>div]:p-0 [&>div]:border-0 [&>div]:bg-transparent">
          <TerminalDemo />
        </ThemePair>
      </Spec>

      {/* ── Media ────────────────────────────────────────────────────────── */}
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
