import { AgentCard } from "@oppenheimer/design-system-web/agent-card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@oppenheimer/design-system-web/alert";
import { AppIcon, AppTile } from "@oppenheimer/design-system-web/app-icon";
import { Avatar, AvatarFallback } from "@oppenheimer/design-system-web/avatar";
import { Badge } from "@oppenheimer/design-system-web/badge";
import { TopItemRow } from "@oppenheimer/design-system-web/breakdown-row";
import { Button } from "@oppenheimer/design-system-web/button";
import { Card, CardContent } from "@oppenheimer/design-system-web/card";
import {
  ChatBubble,
  ChatMark,
  ChatTyping,
} from "@oppenheimer/design-system-web/chat-bubble";
import { DeltaText } from "@oppenheimer/design-system-web/delta-text";
import { FeatureRow } from "@oppenheimer/design-system-web/feature-row";
import { IconButton } from "@oppenheimer/design-system-web/icon-button";
import { Kpi, KpiCard } from "@oppenheimer/design-system-web/kpi";
import { PromptCard } from "@oppenheimer/design-system-web/prompt-card";
import { SearchInput } from "@oppenheimer/design-system-web/search-input";
import { Separator } from "@oppenheimer/design-system-web/separator";
import { Skeleton } from "@oppenheimer/design-system-web/skeleton";
import { Sparkline } from "@oppenheimer/design-system-web/sparkline";
import { StageBreakdown } from "@oppenheimer/design-system-web/stage-breakdown";
import { Switch } from "@oppenheimer/design-system-web/switch";
import { Tag } from "@oppenheimer/design-system-web/tag";
import { Toggle } from "@oppenheimer/design-system-web/toggle";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@oppenheimer/design-system-web/toggle-group";
import {
  AlertCircleIcon,
  BellIcon,
  BoldIcon,
  CircleCheckIcon,
  CircleXIcon,
  FileTextIcon,
  InfoIcon,
  GlobeIcon,
  ItalicIcon,
  MonitorIcon,
  PlugIcon,
  PauseCircleIcon,
  PlusIcon,
  SettingsIcon,
  SmartphoneIcon,
  SparklesIcon,
  Trash2Icon,
  TrendingUpIcon,
  UnderlineIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import {
  ApprovalDemo,
  ChartDemo,
  CommandPaletteDemo,
  ComposerDemo,
  DialogDemo,
  ToolCallDemo,
} from "@/components/component-demos";
import {
  Attachments,
  Bubbles,
  Messages,
  QuestionnaireDemo,
  Scroller,
} from "@/components/chat";
import { LeadTable } from "@/components/lead-table";
import {
  FacetFilterDemo,
  MailboxPickerDemo,
  MailboxTagDemo,
  MailRailDemo,
  MessageListDemo,
  MessageReaderDemo,
  ReplyBoxDemo,
} from "@/components/mail";
import {
  RolePill,
  ScopeCell,
  ScoreCell,
  SourceCell,
  StageTag,
  TeamStatus,
} from "@/components/data-cells";
import {
  ActionsDropdown,
  Autocompletes,
  Choices,
  Comboboxes,
  EnvDropdown,
  SelectMenus,
  Selects,
  StatusFilter,
  TextFields,
} from "@/components/forms";
import {
  Colors,
  ICON_NAMES,
  Icons,
  Radii,
  Typography,
} from "@/components/foundations";
import { PageHead, PageShell, Spec, Swatch } from "@/components/page-shell";
import {
  NavItems,
  Recents,
  SectionLabels,
  Segmented,
  StepperDemo,
  UnderlineTabs,
} from "@/components/patterns";
import { TOC_COUNT } from "@/lib/toc";

/**
 * One callout per status tone. The copy is deliberately operational — a status
 * callout earns its colour by reporting a state, not by decorating a notice.
 */
const ALERT_STATUSES = [
  {
    variant: "active" as const,
    icon: CircleCheckIcon,
    title: "Campaign is live",
    body: "Leads are syncing every 5 minutes.",
  },
  {
    variant: "paused" as const,
    icon: PauseCircleIcon,
    title: "Sync paused",
    body: "Resume it to keep pulling new leads.",
  },
  {
    variant: "ended" as const,
    icon: CircleXIcon,
    title: "Import failed",
    body: "Four rows were rejected. Download the report to fix them.",
  },
  {
    variant: "draft" as const,
    icon: InfoIcon,
    title: "Draft not published",
    body: "Only you can see this campaign until you publish it.",
  },
];

const APPS = [
  "slack",
  "zoom",
  "notion",
  "figma",
  "github",
  "asana",
  "trello",
  "x",
];

/* ────────────────────────────────────────────────────────────────────────── */

export default function DesignSystemPage() {
  return (
    <PageShell>
      <PageHead
        title="Components"
        sub="Every building block in the system — live, on-brand, and ready to compose. Foundations, core, forms, data, patterns, product, navigation and the assistant."
      />

      <div className="mb-12 flex flex-wrap gap-2">
        <Tag size="sm" selected>
          {TOC_COUNT} components
        </Tag>
        <Tag size="sm">Flat · monochrome</Tag>
        <Tag size="sm">SF Pro · 4 sizes</Tag>
      </div>

      {/* ── Foundations ───────────────────────────────────────────────── */}

      <Spec
        id="colors"
        title="Colors"
        meta="tokens/colors.css"
        desc="Three neutral inks over warm off-white surfaces. Color appears only as a status signal — never decoration."
      >
        <Colors />
      </Spec>

      <Spec
        id="type"
        title="Typography"
        meta="tokens/typography.css"
        desc="SF Pro, regular and medium only, tracked −0.15px. Just four sizes; hierarchy comes from ink and weight, not size alone."
      >
        <Typography />
      </Spec>

      <Spec
        id="radius"
        title="Radius"
        meta="tokens/radius.css"
        desc="Exactly three radii across the system."
      >
        <Radii />
      </Spec>

      <Spec
        id="icons"
        title="Icons"
        meta="core/Icon · Lucide"
        desc={`Thin single-weight line icons from Lucide. 14px in navigation, 20px on cards. Any Lucide name works — these are the ${ICON_NAMES.length} used across the product.`}
        code={`<UsersIcon className="size-3.5 text-ink-600" />`}
      >
        <Icons />
      </Spec>

      {/* ── Core ──────────────────────────────────────────────────────── */}

      <Spec
        id="buttons"
        title="Buttons"
        meta="core/Button"
        desc="The pill CTA. Primary is warm near-black; sentence-case, verb-first labels."
        code={`<Button icon="plus">New task</Button>`}
      >
        <Swatch label="primary">
          <Button>New task</Button>
        </Swatch>
        <Swatch label="secondary">
          <Button variant="secondary">Copy</Button>
        </Swatch>
        <Swatch label="ghost">
          <Button variant="ghost">Cancel</Button>
        </Swatch>
        <Swatch label="with icon">
          <Button>
            <PlusIcon />
            Add domain
          </Button>
        </Swatch>
        <Swatch label="small">
          <Button size="sm">Publish</Button>
        </Swatch>
        <Swatch label="disabled">
          <Button disabled>Connect</Button>
        </Swatch>
      </Spec>

      <Spec
        id="iconbuttons"
        title="Icon buttons"
        meta="core/IconButton"
        desc="Square single-icon control for toolbars and add actions."
        code={`<IconButton variant="outline"><PlusIcon /></IconButton>`}
      >
        <Swatch label="outline">
          <IconButton aria-label="Add">
            <PlusIcon />
          </IconButton>
        </Swatch>
        <Swatch label="ghost">
          <IconButton variant="ghost" aria-label="Notifications">
            <BellIcon />
          </IconButton>
        </Swatch>
        <Swatch label="filled">
          <IconButton variant="filled" aria-label="Settings">
            <SettingsIcon />
          </IconButton>
        </Swatch>
        <Swatch label="disabled">
          <IconButton disabled aria-label="Delete">
            <Trash2Icon />
          </IconButton>
        </Swatch>
      </Spec>

      <Spec
        id="toggle"
        title="Toggle"
        meta="core/Switch"
        desc="iOS-style switch. Blue track when on; used for permissions and settings."
        code={`<Switch checked={on} onCheckedChange={setOn} />`}
      >
        <Swatch label="on">
          <Switch defaultChecked />
        </Swatch>
        <Swatch label="off">
          <Switch />
        </Swatch>
        <Swatch label="disabled">
          <Switch defaultChecked disabled />
        </Swatch>
      </Spec>

      <Spec
        id="inputs"
        title="Inputs"
        meta="core/SearchInput"
        desc="Quiet search field with a leading icon and an optional ⌘K hint."
        code={`<SearchInput placeholder="Search" />`}
      >
        <Swatch label="default" width={280}>
          <SearchInput />
        </Swatch>
        <Swatch label="no hint" width={280}>
          <SearchInput hint={null} placeholder="Search leads…" />
        </Swatch>
      </Spec>

      <Spec
        id="tags"
        title="Chips & tags"
        meta="core/Tag"
        desc="Category pills. Selected is a dark fill; unselected is white with a hairline."
        code={`<Tag selected>All agents</Tag>`}
      >
        <Swatch label="selected">
          <Tag selected>All agents</Tag>
        </Swatch>
        <Swatch label="default">
          <Tag>Sales</Tag>
        </Swatch>
        <Swatch label="small">
          <Tag size="sm">Hotel</Tag>
        </Swatch>
        <Swatch label="row">
          <div className="flex gap-2">
            <Tag size="sm" selected>
              All
            </Tag>
            <Tag size="sm">Real estate</Tag>
            <Tag size="sm">Content</Tag>
          </div>
        </Swatch>
      </Spec>

      <Spec
        id="badges"
        title="Badges"
        meta="core/Badge"
        desc="Small markers: a blue count pill, the pink “New” label, or a neutral chip."
        code={`<Badge variant="count">6</Badge>`}
      >
        <Swatch label="count">
          <Badge variant="count">6</Badge>
        </Swatch>
        <Swatch label="new">
          <Badge variant="new">New</Badge>
        </Swatch>
        <Swatch label="neutral">
          <Badge variant="neutral">Draft</Badge>
        </Swatch>
      </Spec>

      <Spec
        id="avatars"
        title="Avatars"
        meta="core/Avatar"
        desc="Round user or org mark — an image, or an initial on a soft brand gradient."
        code={`<Avatar size={32}><AvatarFallback gradient="purple">A</AvatarFallback></Avatar>`}
      >
        {(["purple", "blue", "teal", "pink"] as const).map(
          (gradient, index) => (
            <Swatch key={gradient} label={gradient}>
              <Avatar size={40}>
                <AvatarFallback gradient={gradient}>
                  {["A", "M", "N", "L"][index]}
                </AvatarFallback>
              </Avatar>
            </Swatch>
          ),
        )}
        <Swatch label="sizes">
          <div className="flex items-center gap-2">
            {[20, 28, 40].map((size) => (
              <Avatar key={size} size={size}>
                <AvatarFallback gradient="purple">A</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </Swatch>
      </Spec>

      <Spec
        id="cards"
        title="Cards"
        meta="core/Card"
        desc="The base white surface — 16px radius, hairline border, no shadow. Stack rows or hold any content."
      >
        <Swatch label="base" width={240}>
          <Card className="w-60">
            <CardContent>
              <div className="text-base font-medium">Workspace</div>
              <div className="mt-1 text-sm text-ink-400">
                4 members · 5 domains
              </div>
            </CardContent>
          </Card>
        </Swatch>
        <Swatch label="interactive" width={240}>
          <Card interactive className="w-60">
            <CardContent>
              <div className="text-base font-medium">Real estate</div>
              <div className="mt-1 text-sm text-ink-400">
                Hover to lift the border
              </div>
            </CardContent>
          </Card>
        </Swatch>
      </Spec>

      {/* ── Forms ─────────────────────────────────────────────────────── */}

      <Spec
        id="textfield"
        title="Text field"
        meta="forms/Input"
        desc="Labelled single-line input on the shared control ladder — 28 / 36 / 44 — so a field and a button on the same toolbar row line up without either being overridden."
        code={`<Input size="sm" placeholder="…" />`}
      >
        <TextFields />
      </Spec>

      <Spec
        id="select"
        title="Select"
        meta="forms/Select"
        desc="Single-choice dropdown with a chevron affordance; on-brand menu chrome with a check on the active row."
        code={`<Select><SelectTrigger>…</SelectTrigger><SelectContent>…</SelectContent></Select>`}
      >
        <Selects />
      </Spec>

      <Spec
        id="selectmenu"
        title="Select menu"
        meta="forms/SelectMenu"
        desc="A pill trigger that opens a menu with a checkmark on the selected row and hover tint — used for the analytics domain and date-range filters. Unlike Select, it takes a leading icon and never carries a field label."
        code={`<SelectMenu value={v} options={[…]} onValueChange={setV} icon={<GlobeIcon />} />`}
      >
        <SelectMenus />
      </Spec>

      <Spec
        id="combobox"
        title="Combobox"
        meta="forms/Combobox"
        desc="The labelled field for picking one value out of a list that grows with the workspace — a teammate, a tracked domain. Same box as Input and Select on a form row, with a search over the options and a row that clears the field. Pass onQueryChange and the search is the API's to answer."
        code={`<Combobox options={owners} value={ownerId} onValueChange={setOwnerId} clearLabel="Unassigned" />`}
      >
        <Comboboxes />
      </Spec>

      <Spec
        id="asyncselect"
        title="Autocomplete"
        meta="forms/AsyncMultiSelect"
        desc="Typeahead combobox for high-cardinality fields — pages or keywords numbering in the thousands. Debounced async search, windowed results (loads more on scroll), pinned selected chips, and full keyboard nav. Use this instead of the checkbox Filter menu whenever the option set is large or dynamic."
        code={`<AsyncMultiSelect fetcher={q => api.pages(q)} selected={sel} onSelectedChange={setSel} />`}
      >
        <Autocompletes />
      </Spec>

      <Spec
        id="dropdown"
        title="Dropdown menu"
        meta="forms/DropdownMenu"
        desc="A trigger button that opens a floating action menu; closes on outside click. Destructive items take the red ink, never a red fill."
        code={`<DropdownMenu /> — Rename / Duplicate / Share / Delete`}
      >
        <ActionsDropdown />
      </Spec>

      <Spec
        id="filtermenu"
        title="Filter menus"
        meta="pattern"
        desc="Toolbar filter triggers with rich popovers: a multi-select status filter (overlapping colour dots, an n/total count, dark checkboxes and a hover “Check all”) and a single-select dropdown with a check on the active option."
      >
        <Swatch label="multi-select">
          <StatusFilter />
        </Swatch>
        <Swatch label="single-select">
          <EnvDropdown />
        </Swatch>
      </Spec>

      <Spec
        id="facetfilter"
        title="Facet filter"
        meta="forms/FilterMenu"
        desc="The component behind the pattern above: additive facets with the size of each on the right. The trigger turns blue and counts what is on — it cannot name the facets, because they narrow together."
        code={`<FilterMenu options={[…]} selected={…} onSelectedChange={…} />`}
      >
        <FacetFilterDemo />
      </Spec>

      <Spec
        id="choice"
        title="Checkbox & radio"
        meta="forms/Checkbox · RadioGroup"
        desc="Multi- and single-select controls sharing the blue accent and hairline outline."
        code={`<Checkbox label="…" /> · <RadioGroup options={[…]} />`}
      >
        <Choices />
      </Spec>

      {/* ── Overlays ──────────────────────────────────────────────────── */}

      <Spec
        id="dialog"
        title="Modals"
        meta="overlays/Dialog"
        desc="A card-radius sheet with 24px interior on a dimmed backdrop — one of the few places the system allows depth."
        code={`<Dialog><DialogTrigger …/><DialogContent>…</DialogContent></Dialog>`}
      >
        <Swatch label="basic sheet">
          <DialogDemo />
        </Swatch>
        <Swatch label="install pattern">
          <DialogDemo variant="install" />
        </Swatch>
        <Swatch label="scrolling body">
          <DialogDemo variant="scroll" />
        </Swatch>
      </Spec>

      <Spec
        id="command"
        title="Command palette"
        meta="overlays/Command · ⌘K"
        desc="Search or jump to. Grouped results, keyboard-first, opened from the topbar or ⌘K anywhere."
        code={`<CommandDialog open={open}><CommandInput /><CommandList>…</CommandList></CommandDialog>`}
      >
        <CommandPaletteDemo />
      </Spec>

      {/* ── Data ──────────────────────────────────────────────────────── */}

      <Spec
        id="status"
        title="Status pills"
        meta="core/Badge · status variants"
        desc="Tinted row status. The four tones map to the status token set: active green, paused amber, ended red, draft blue."
        code={`<Badge variant="active">Active</Badge>`}
      >
        <Swatch label="active">
          <Badge variant="active">Active</Badge>
        </Swatch>
        <Swatch label="paused">
          <Badge variant="paused">Paused</Badge>
        </Swatch>
        <Swatch label="ended">
          <Badge variant="ended">Ended</Badge>
        </Swatch>
        <Swatch label="draft">
          <Badge variant="draft">Draft</Badge>
        </Swatch>
      </Spec>

      <Spec
        id="delta"
        title="Delta & sparkline"
        meta="data/DeltaText · Sparkline"
        desc="A signed change, green up / red down, and a tiny SVG trend that fits inside a table cell."
        code={`<DeltaText value={12} caret /> · <Sparkline data={[…]} />`}
      >
        <Swatch label="up">
          <DeltaText value={12} caret />
        </Swatch>
        <Swatch label="down">
          <DeltaText value={-4.2} caret />
        </Swatch>
        <Swatch label="no caret">
          <DeltaText value={8} />
        </Swatch>
        <Swatch label="line">
          <Sparkline data={[4, 6, 5, 9, 8, 12, 11, 15]} />
        </Swatch>
        <Swatch label="area">
          <Sparkline data={[4, 6, 5, 9, 8, 12, 11, 15]} fill />
        </Swatch>
        <Swatch label="bar">
          <Sparkline
            data={[4, 6, 5, 9, 8, 12, 11, 15]}
            type="bar"
            color="var(--data-track)"
          />
        </Swatch>
        <Swatch label="down trend">
          <Sparkline
            data={[15, 12, 13, 9, 10, 6, 5]}
            color="var(--data-down)"
          />
        </Swatch>
      </Spec>

      <Spec
        id="kpi"
        title="KPIs"
        meta="data/KpiCard · Kpi"
        desc="Bordered metric card with sparkline, or a bare stat block for the strip above a chart."
      >
        <div className="grid w-full grid-cols-[repeat(2,minmax(210px,1fr))] gap-3.5">
          <KpiCard
            label="Total leads"
            icon={<UserRoundIcon />}
            value="399"
            delta={12}
            spark={[240, 270, 300, 340, 370, 399]}
          />
          <KpiCard
            label="Qualified"
            icon={<CircleCheckIcon />}
            value="148"
            delta={8}
            spark={[96, 108, 120, 132, 140, 148]}
          />
        </div>
        <Card className="flex w-full flex-row gap-0 p-0">
          <Kpi
            label="Domains"
            value="5"
            delta={4}
            icon={<GlobeIcon />}
            selected
          />
          <Kpi
            label="Members"
            value="4"
            delta={0}
            icon={<UsersIcon />}
            divider
          />
          <Kpi
            label="Conversion"
            value="33.6%"
            delta={-2}
            icon={<TrendingUpIcon />}
            divider
          />
        </Card>
      </Spec>

      <Spec
        id="breakdown"
        title="Breakdown & rankings"
        meta="data/BreakdownRow · TopItemRow"
        desc="Labeled line items with a trend spark, and ranked rows with a share bar."
      >
        <Card className="w-[340px]">
          <CardContent>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium">Leads by stage</span>
              <span className="text-xs text-muted-foreground">420 total</span>
            </div>
            <StageBreakdown
              total={420}
              items={[
                {
                  id: "qualified",
                  label: "Qualified",
                  value: 148,
                  delta: 8,
                  tone: "active",
                },
                {
                  id: "contacted",
                  label: "Contacted",
                  value: 132,
                  delta: 5,
                  tone: "paused",
                },
                {
                  id: "new",
                  label: "New",
                  value: 87,
                  delta: 12,
                  tone: "draft",
                },
                {
                  id: "lost",
                  label: "Lost",
                  value: 32,
                  delta: -4,
                  tone: "ended",
                },
              ]}
            />
          </CardContent>
        </Card>
        <Card className="w-[340px]">
          <CardContent>
            <div className="mb-2 text-base font-medium">Top domains</div>
            <TopItemRow
              media="🌐"
              name="oppenheimer.dev"
              value="214"
              count="54%"
              ratio={1}
            />
            <TopItemRow
              media="🌐"
              name="app.oppenheimer.dev"
              value="96"
              count="24%"
              ratio={0.45}
            />
            <TopItemRow
              media="🌐"
              name="blog.oppenheimer.dev"
              value="58"
              count="15%"
              ratio={0.27}
            />
          </CardContent>
        </Card>
      </Spec>

      <Spec
        id="chart"
        title="Line chart"
        meta="data/Chart · Recharts"
        desc="The primary series in blue with a dotted comparison line, hairline gridlines and a card-radius tooltip."
        code={`<ChartContainer config={config}><LineChart …/></ChartContainer>`}
      >
        <ChartDemo />
      </Spec>

      <Spec
        id="tableblock"
        title="Table"
        meta="DataTableBlock"
        desc="The one table pattern used across the product: a toolbar (left search, right filter + primary action), sortable headers, row selection with a bulk-action bar, a right-aligned per-row actions menu, a multi-select filter popover and a pagination footer."
        code={`<Table><TableHeader>…</TableHeader><TableBody>…</TableBody></Table>`}
      >
        <LeadTable />
      </Spec>

      <Spec
        id="datacells"
        title="Data cells"
        meta="pattern"
        desc="The small in-table cells used across Team and Leads: a role pill, member status, domain scope, lead source, a score meter and the pipeline stage tag."
      >
        <Swatch label="RolePill">
          <RolePill role="SEO manager" />
        </Swatch>
        <Swatch label="member status">
          <TeamStatus status="active" />
        </Swatch>
        <Swatch label="away">
          <TeamStatus status="away" />
        </Swatch>
        <Swatch label="invited">
          <TeamStatus status="invited" />
        </Swatch>
        <Swatch label="domain scope">
          <ScopeCell scope="some" count={3} />
        </Swatch>
        <Swatch label="lead source">
          <SourceCell source="Organic search" />
        </Swatch>
        <Swatch label="lead score">
          <ScoreCell score={88} />
        </Swatch>
        <Swatch label="pipeline stage">
          <StageTag stage="Qualified" />
        </Swatch>
      </Spec>

      {/* ── Patterns ──────────────────────────────────────────────────── */}

      <Spec
        id="tabs"
        title="Tabs"
        meta="pattern"
        desc="Underline tab strip with a count per tab and a blue active indicator — used to split the Team page into Members and Roles."
      >
        <UnderlineTabs />
      </Spec>

      <Spec
        id="segmented"
        title="Segmented control"
        meta="pattern"
        desc="A compact 2–3 option switch with a dark active pill. Used for per-area permissions (None / View / Edit) and access presets."
      >
        <Swatch label="permission level">
          <Segmented />
        </Swatch>
      </Spec>

      <Spec
        id="togglebutton"
        title="Toggle button"
        meta="patterns/Toggle"
        desc="A pill chip for editor controls. Pressed reads as the brand's selected state: dark fill, white label."
        code={`<Toggle aria-label="Bold"><BoldIcon /></Toggle>`}
      >
        <Swatch label="pressed">
          <Toggle aria-label="Bold" defaultPressed>
            <BoldIcon />
          </Toggle>
        </Swatch>
        <Swatch label="default">
          <Toggle aria-label="Italic">
            <ItalicIcon />
          </Toggle>
        </Swatch>
        <Swatch label="outline">
          <Toggle variant="outline" aria-label="Underline">
            <UnderlineIcon />
          </Toggle>
        </Swatch>
        <Swatch label="group">
          <ToggleGroup defaultValue={["bold"]}>
            <ToggleGroupItem value="bold" aria-label="Bold">
              <BoldIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="italic" aria-label="Italic">
              <ItalicIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="underline" aria-label="Underline">
              <UnderlineIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        </Swatch>
      </Spec>

      <Spec
        id="stepper"
        title="Stage stepper"
        meta="patterns/Stepper"
        desc="The pipeline bar from the lead drawer: flat tracks filled to the current stage, with terminal stages taking their own tone."
        code={`<Stepper steps={STAGES} value={stage} onValueChange={setStage} />`}
      >
        <StepperDemo />
      </Spec>

      {/* ── Product ───────────────────────────────────────────────────── */}

      <Spec
        id="agent"
        title="Agent cards"
        meta="product/AgentCard"
        desc="The marketplace card: an aurora-gradient header carrying floating white app plates, then a white body with the title, one line of description and the maker credit. The gradients are the only imagery in the system."
        code={`<AgentCard title="…" apps={['slack']} author="Rico" gradient="blueLilac" />`}
      >
        <AgentCard
          title="Niche Content Composer"
          description="Daily niche content, fully automated"
          apps={["notion", "slack"]}
          author="Rico"
          gradient="blueLilac"
        />
        <AgentCard
          title="Probate & FSBO Lead Hunter"
          description="Finds high-intent real estate leads"
          apps={["googlesheets", "whatsapp"]}
          author="Mara"
          gradient="peachYellow"
        />
      </Spec>

      <Spec
        id="apps"
        title="App icons & tiles"
        meta="product/AppIcon · AppTile"
        desc="Full-color brand marks on rounded tiles, and connect rows for the Apps grid."
      >
        <Swatch label="icons" width="100%">
          <div className="flex flex-wrap gap-3">
            {APPS.map((app) => (
              <AppIcon key={app} app={app} size={44} />
            ))}
          </div>
        </Swatch>
        <div className="w-full max-w-[420px]">
          <AppTile
            app="slack"
            name="Slack"
            description="Collaborate directly from Slack"
          />
          <AppTile
            app="zoom"
            name="Zoom"
            description="Host virtual meetings and webinars"
            connected
          />
        </div>
      </Spec>

      <Spec
        id="feature"
        title="Feature rows"
        meta="product/FeatureRow"
        desc="A 20px line icon beside a 2–3 word title and one supporting line. Stack several inside a card; rows self-divide with a hairline."
        code={`<FeatureRow icon={<MonitorIcon />} title="Resume instantly" description="…" />`}
      >
        <Card className="w-full max-w-lg gap-0 py-0">
          <FeatureRow
            icon={<MonitorIcon />}
            title="Resume instantly"
            description="Pick up any agent run or workspace from your desktop"
          />
          <FeatureRow
            icon={<SmartphoneIcon />}
            title="Start from anywhere"
            description="Kick off a task from your phone and finish on the desktop"
          />
          <FeatureRow
            icon={<PlugIcon />}
            title="Bring your tools"
            description="Connect the apps your team already runs on"
          />
        </Card>
      </Spec>

      {/* ── Mail ──────────────────────────────────────────────────────── */}

      <Spec
        id="mailrail"
        title="Mailbox rail"
        meta="mail/MailboxRail"
        desc="The mail client's left rail: folder rows with their totals, then every mailbox grouped under the domain that owns it. A folder with nothing in it shows no number rather than a zero."
        code={`<MailboxRail><MailboxRailRow …/><MailboxRailGroup>…</MailboxRailGroup></MailboxRail>`}
      >
        <MailRailDemo />
      </Spec>

      <Spec
        id="mailboxpicker"
        title="Mailbox picker"
        meta="mail/MailboxPicker"
        desc="A searchable multi-select over every mailbox, grouped by domain and selectable a whole domain at a time. The trigger names the selection by the tightest thing that fits — one address, a domain, or a count."
        code={`<MailboxPicker mailboxes={…} selected={…} onSelectedChange={…} />`}
      >
        <MailboxPickerDemo />
      </Spec>

      <Spec
        id="mailboxtag"
        title="Mailbox tag & chip"
        meta="mail/MailboxTag · MailboxChip"
        desc="The pill naming the mailbox a message landed in, with that mailbox's purpose dot. The chip is the removable form, used in the toolbar's “currently filtering by” row."
        code={`<MailboxTag tone="#1F9D57">…</MailboxTag> · <MailboxChip onRemove={…}>…</MailboxChip>`}
      >
        <MailboxTagDemo />
      </Spec>

      <Spec
        id="messagelist"
        title="Message list"
        meta="mail/MessageList · MessageListItem"
        desc="Unread is the lit state, not the bold one alone: the row lifts to the card white, takes the blue dot, and sets sender and subject in medium. Three signals for one fact, because the row is scanned rather than read."
        code={`<MessageList><MessageListItem unread from={…} subject={…} …/></MessageList>`}
      >
        <MessageListDemo />
      </Spec>

      <Spec
        id="messagereader"
        title="Message reader"
        meta="mail/MessageReader"
        desc="The reading pane's contents — subject, sender, body, attachment, the record the message is linked to, and the reply. The panel around them is a Sheet, the same overlay as every other detail view."
        code={`<MessageReader><MessageReaderHeader/><MessageReaderBody/><MessageAttachment/></MessageReader>`}
      >
        <MessageReaderDemo />
      </Spec>

      <Spec
        id="replybox"
        title="Reply box"
        meta="mail/ReplyBox"
        desc="A letter, not a prompt: multi-paragraph by default, Enter inserts a newline, and the send control is the workspace's ordinary CTA. Composer is the assistant's input and stays separate for exactly those reasons."
        code={`<ReplyBox value={…} onValueChange={…} toolbar={…} actions={…} />`}
      >
        <ReplyBoxDemo />
      </Spec>

      {/* ── Navigation ────────────────────────────────────────────────── */}

      <Spec
        id="nav"
        title="Nav items"
        meta="navigation/NavItem"
        desc="Sidebar row: 14px icon + label with an optional trailing slot. Active gets a sunken fill."
      >
        <NavItems />
      </Spec>

      <Spec
        id="recents"
        title="Recents"
        meta="navigation/RecentItem"
        desc="A live status dot and a truncating label — filled cyan when a run is active."
      >
        <Recents />
      </Spec>

      <Spec
        id="sectionlabel"
        title="Section labels"
        meta="navigation/SectionLabel"
        desc="The quiet gray group header in the sidebar."
      >
        <SectionLabels />
      </Spec>

      {/* ── Assistant ─────────────────────────────────────────────────── */}

      <Spec
        id="askai"
        title="Ask AI button"
        meta="patterns · Button"
        desc="The topbar entry point to the assistant: a white hairline pill with the sparkle mark, sitting beside the utility icons."
        code={`<Button variant="outline" size="sm"><SparklesIcon />Ask AI</Button>`}
      >
        <Swatch label="top-bar trigger">
          <Button variant="secondary" size="sm">
            <SparklesIcon />
            Ask AI
          </Button>
        </Swatch>
      </Spec>

      <Spec
        id="promptcards"
        title="Prompt cards"
        meta="assistant/PromptCard"
        desc="The assistant's empty state: suggested prompts as tiled rows with a title, one line of description and a trailing chevron."
        code={`<PromptCard icon={<UserRoundIcon />} title="Find high-intent leads" description="…" />`}
      >
        <div className="flex w-full max-w-[460px] flex-col gap-2">
          <PromptCard
            icon={<UserRoundIcon />}
            title="Find high-intent leads"
            description="Surface this week's best leads across domains"
          />
          <PromptCard
            icon={<TrendingUpIcon />}
            title="What changed in rankings?"
            description="Summarise position gains and drops"
          />
          <PromptCard
            icon={<FileTextIcon />}
            title="Draft a follow-up"
            description="Write an email for a qualified lead"
          />
        </div>
      </Spec>

      <Spec
        id="chat"
        title="Chat bubbles"
        meta="assistant/ChatBubble"
        desc="The user's turn is the dark inverse fill, right-aligned; the assistant's is a white card with a hairline, led by its mark."
        code={`<ChatBubble from="user">…</ChatBubble>`}
      >
        <div className="flex w-full max-w-[460px] flex-col gap-4.5">
          <ChatBubble
            from="user"
            avatar={
              <Avatar size={28}>
                <AvatarFallback gradient="purple">A</AvatarFallback>
              </Avatar>
            }
          >
            Find high-intent leads this week
          </ChatBubble>
          <ChatBubble
            from="assistant"
            avatar={
              <ChatMark>
                <SparklesIcon className="text-ink-600" />
              </ChatMark>
            }
          >
            Three leads stand out: Priya Nair (88), Amara Okafor (95) and Tomás
            Rivera (76). Want follow-ups drafted?
          </ChatBubble>
          <ChatBubble
            from="assistant"
            avatar={
              <ChatMark>
                <SparklesIcon className="text-ink-600" />
              </ChatMark>
            }
          >
            <ChatTyping />
          </ChatBubble>
        </div>
      </Spec>

      <Spec
        id="composer"
        title="Composer"
        meta="assistant/Composer"
        desc="A card-radius well with an auto-growing textarea over a toolbar row and the blue send button. Enter sends; Shift+Enter adds a line. The toolbar takes anything — here a ghost SelectMenu picking the model."
        code={`<Composer value={value} onValueChange={setValue} onSubmit={send} toolbar={<SelectMenu variant="ghost" … />} />`}
      >
        <ComposerDemo />
      </Spec>

      <Spec
        id="toolcall"
        title="Tool call"
        meta="assistant/ToolCall"
        desc="One step the assistant took, folded shut. The row is the claim, the panel is the evidence — arguments and payload — so an answer stays readable while remaining auditable."
        code={`<ToolCall status="complete"><ToolCallTrigger>…</ToolCallTrigger><ToolCallContent>…</ToolCallContent></ToolCall>`}
      >
        <ToolCallDemo />
      </Spec>

      <Spec
        id="approval"
        title="Approval"
        meta="assistant/Approval"
        desc="An action the assistant proposed and will not take until somebody clicks. The details list is a first-class part: what is about to happen has to read without the paragraph above it."
        code={`<Approval status="pending"><ApprovalHeader>…</ApprovalHeader><ApprovalDetails>…</ApprovalDetails><ApprovalActions>…</ApprovalActions></Approval>`}
      >
        <ApprovalDemo />
      </Spec>

      {/* ── Chat ──────────────────────────────────────────────────────── */}

      <Spec
        id="attachment"
        title="Attachment"
        meta="chat/Attachment"
        desc="A file chip for the composer and the thread: media tile, name, type and size, with actions that stay separately clickable inside a full-card trigger."
        code={`<Attachment><AttachmentMedia>…</AttachmentMedia><AttachmentContent>…</AttachmentContent></Attachment>`}
      >
        <Attachments />
      </Spec>

      <Spec
        id="bubble"
        title="Bubble"
        meta="chat/Bubble"
        desc="The message surface itself. Filled for the person speaking, muted for the reply — the brand keeps both at the tile radius and neither takes elevation."
        code={`<Bubble variant="muted"><BubbleContent>…</BubbleContent></Bubble>`}
      >
        <Bubbles />
      </Spec>

      <Spec
        id="message"
        title="Message"
        meta="chat/Message"
        desc="The conversation row that positions a bubble: avatar, alignment, header and footer. Align end to flip the whole row for the outgoing side."
        code={`<Message align="end"><MessageContent><Bubble>…</Bubble></MessageContent></Message>`}
      >
        <Messages />
      </Spec>

      <Spec
        id="messagescroller"
        title="Message scroller"
        meta="chat/MessageScroller"
        desc="The scroll container for a thread — anchored turns, streamed replies, restored position and a jump-to-end control that only appears once you have scrolled away."
        code={`<MessageScrollerProvider><MessageScroller>…<MessageScrollerButton /></MessageScroller></MessageScrollerProvider>`}
      >
        <Scroller />
      </Spec>

      <Spec
        id="questionnaire"
        title="Questionnaire"
        meta="chat/Questionnaire"
        desc="A stepped set of questions the assistant can ask inline: progress, single- or multi-choice items with descriptions, and previous/next actions."
        code={`<Questionnaire><QuestionnaireItem name="…"><QuestionnaireChoices>…</QuestionnaireChoices></QuestionnaireItem></Questionnaire>`}
      >
        <QuestionnaireDemo />
      </Spec>

      {/* ── Utility ───────────────────────────────────────────────────── */}

      <Spec
        id="alert"
        title="Alerts"
        meta="core/Alert"
        desc="A card-radius surface with a leading icon. The destructive callout and the status ones — active, paused, ended, draft — colour the ink and the hairline, never the fill."
        code={`<Alert variant="paused"><AlertTitle>…</AlertTitle><AlertDescription>…</AlertDescription></Alert>`}
      >
        <Alert icon={AlertCircleIcon} className="w-full max-w-lg">
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>
            Two domains have not been verified yet.
          </AlertDescription>
        </Alert>
        {/* The failure callout every form and page in the product reaches for
            when a submission or a query fails. It carries a description alone
            there, which is the shape shown here. */}
        <Alert variant="destructive" className="w-full max-w-lg">
          <AlertDescription>Incorrect email or password.</AlertDescription>
        </Alert>
        {ALERT_STATUSES.map((status) => (
          <Alert
            key={status.variant}
            variant={status.variant}
            icon={status.icon}
            className="w-full max-w-lg"
          >
            <AlertTitle>{status.title}</AlertTitle>
            <AlertDescription>{status.body}</AlertDescription>
          </Alert>
        ))}
      </Spec>

      <Spec
        id="separator"
        title="Separator"
        meta="core/Separator"
        desc="The hairline that carries the structure everywhere else in the system."
        code={`<Separator />`}
      >
        <div className="w-full max-w-lg space-y-3">
          <p className="text-base">Above the separator</p>
          <Separator />
          <p className="text-base">Below the separator</p>
        </div>
      </Spec>

      <Spec
        id="skeleton"
        title="Skeleton"
        meta="core/Skeleton"
        desc="Loading placeholders at the control radius, on the inactive-fill neutral so they stay legible on both card and canvas."
        code={`<Skeleton className="h-4 w-[250px]" />`}
      >
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </Spec>
    </PageShell>
  );
}
