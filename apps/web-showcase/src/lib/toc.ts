import {
  AppWindowIcon,
  BadgeIcon,
  BellIcon,
  AtSignIcon,
  BarChart3Icon,
  BotIcon,
  ChevronDownCircleIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleUserRoundIcon,
  CodeIcon,
  CpuIcon,
  HeadingIcon,
  PanelTopIcon,
  ImageIcon,
  KeyboardIcon,
  LayersIcon,
  LayoutGridIcon,
  LinkIcon,
  LoaderIcon,
  ListChecksIcon,
  SquareCheckIcon,
  ListIcon,
  ListOrderedIcon,
  ListStartIcon,
  MenuIcon,
  MessageSquareIcon,
  MessageSquareWarningIcon,
  MinusIcon,
  MousePointerClickIcon,
  PaletteIcon,
  PanelLeftIcon,
  RectangleHorizontalIcon,
  RowsIcon,
  RulerIcon,
  SearchIcon,
  ShapesIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SquareAsteriskIcon,
  SquareChevronDownIcon,
  SquareDashedIcon,
  SquareIcon,
  SquarePlusIcon,
  TableIcon,
  TagIcon,
  TerminalIcon,
  TextCursorInputIcon,
  TextIcon,
  TriangleAlertIcon,
  ToggleLeftIcon,
  type LucideIcon,
  TypeIcon,
  WavesIcon,
  ZapIcon,
} from '@oppenheimer/design-system-web/icons';

/**
 * `components` names the files in the design system's `src/components/` that
 * the section shows. Every file there is listed exactly once, and the design
 * system's `test` (`scripts/check-exports.mjs`) holds the two to each other:
 * this list is the inventory.
 */
export type TocItem = { id: string; label: string; icon: LucideIcon; components: string[] };
export type TocGroup = { group: string; items: TocItem[] };

/**
 * The inventory, in the design export's order: foundations first, then the
 * component families the MVP screens are built from. Drives the sidebar and
 * the reading order of the page; keep it in step with the `<Spec id>` values,
 * since the scroll-spy matches on them.
 */
export const TOC: TocGroup[] = [
  {
    group: 'Foundations',
    items: [
      { id: 'colors', label: 'Colours', icon: PaletteIcon, components: [] },
      { id: 'type', label: 'Typography', icon: TypeIcon, components: [] },
      { id: 'space', label: 'Space', icon: RulerIcon, components: [] },
      { id: 'radius', label: 'Radii', icon: SquareIcon, components: [] },
      { id: 'elevation', label: 'Elevation', icon: LayersIcon, components: [] },
      { id: 'motion', label: 'Motion', icon: WavesIcon, components: [] },
      { id: 'icons', label: 'Icons', icon: ShapesIcon, components: ['icons'] },
    ],
  },
  {
    group: 'Core',
    items: [
      { id: 'wordmark', label: 'Wordmark · BrandMark', icon: SquareAsteriskIcon, components: ['wordmark', 'brand-mark', 'brand-glyph'] },
      { id: 'buttons', label: 'Button', icon: MousePointerClickIcon, components: ['button'] },
      { id: 'iconbuttons', label: 'IconButton', icon: SquarePlusIcon, components: ['icon-button'] },
      { id: 'links', label: 'Link', icon: LinkIcon, components: ['link'] },
      { id: 'badges', label: 'Badge', icon: BadgeIcon, components: ['badge'] },
      { id: 'chips', label: 'Chip', icon: TagIcon, components: ['chip'] },
      { id: 'statusdot', label: 'StatusDot', icon: CircleDotIcon, components: ['status-dot'] },
      { id: 'avatars', label: 'Avatar', icon: CircleUserRoundIcon, components: ['avatar'] },
      { id: 'separators', label: 'Separator', icon: MinusIcon, components: ['separator'] },
      { id: 'kbd', label: 'Kbd', icon: KeyboardIcon, components: ['kbd'] },
      { id: 'cards', label: 'Card', icon: RectangleHorizontalIcon, components: ['card'] },
      { id: 'codeblock', label: 'CodeBlock', icon: CodeIcon, components: ['code-block'] },
      { id: 'emptystate', label: 'EmptyState', icon: SquareDashedIcon, components: ['empty-state'] },
      { id: 'skeleton', label: 'Skeleton', icon: LoaderIcon, components: ['skeleton'] },
      { id: 'summarycard', label: 'SummaryCard', icon: ListChecksIcon, components: ['summary-card'] },
      { id: 'successmark', label: 'SuccessMark', icon: CircleCheckIcon, components: ['success-mark'] },
      { id: 'stepheader', label: 'StepHeader', icon: ListStartIcon, components: ['step-header'] },
      { id: 'agentmark', label: 'AgentMark', icon: BotIcon, components: ['agent-mark'] },
    ],
  },
  {
    group: 'Forms',
    items: [
      { id: 'fields', label: 'Field & Input', icon: TextCursorInputIcon, components: ['field', 'input', 'password-input'] },
      { id: 'sluginput', label: 'SlugInput', icon: AtSignIcon, components: ['slug-input'] },
      { id: 'segmented', label: 'SegmentedControl', icon: ToggleLeftIcon, components: ['segmented-control'] },
      { id: 'textarea', label: 'Textarea', icon: TextIcon, components: ['textarea'] },
      { id: 'checkbox', label: 'Checkbox', icon: SquareCheckIcon, components: ['checkbox'] },
      { id: 'disclosure', label: 'Disclosure', icon: ChevronDownCircleIcon, components: ['disclosure'] },
      { id: 'chipselect', label: 'ChipSelect', icon: SquareChevronDownIcon, components: ['chip-select', 'popover'] },
      { id: 'reporows', label: 'RepositoryAddField · RepositoryRowList', icon: ListChecksIcon, components: ['repository-add-field', 'repository-row-list', 'repository-select'] },
      { id: 'fieldselect', label: 'FieldSelect', icon: SquareChevronDownIcon, components: ['field-select'] },
      { id: 'composer', label: 'Composer', icon: MessageSquareIcon, components: ['composer'] },
      { id: 'engine', label: 'AgentModelSelect', icon: BotIcon, components: ['agent-model-select'] },
      { id: 'effort', label: 'EffortSlider', icon: SlidersHorizontalIcon, components: ['effort-slider'] },
      { id: 'permission', label: 'PermissionMenu', icon: ShieldCheckIcon, components: ['permission-menu'] },
    ],
  },
  {
    group: 'Overlays',
    items: [
      { id: 'callout', label: 'Callout', icon: MessageSquareWarningIcon, components: ['callout'] },
      { id: 'alert', label: 'Alert', icon: TriangleAlertIcon, components: ['alert'] },
      { id: 'dialog', label: 'Dialog', icon: AppWindowIcon, components: ['dialog'] },
      { id: 'dropdown', label: 'DropdownMenu', icon: MenuIcon, components: ['dropdown-menu'] },
      { id: 'command', label: 'Command', icon: SearchIcon, components: ['command'] },
      { id: 'tooltip', label: 'Tooltip', icon: ChevronDownCircleIcon, components: ['tooltip'] },
      { id: 'toast', label: 'Toast', icon: BellIcon, components: ['sonner'] },
    ],
  },
  {
    group: 'Navigation',
    items: [
      { id: 'sidebar', label: 'Rail · Sidebar', icon: PanelLeftIcon, components: ['rail', 'sidebar', 'session-item'] },
      { id: 'routineitem', label: 'RoutineItem', icon: ZapIcon, components: ['routine-item'] },
      { id: 'pilltabs', label: 'PillTabs', icon: ToggleLeftIcon, components: ['pill-tabs'] },
      { id: 'editorpage', label: 'EditorPage', icon: PanelTopIcon, components: ['editor-page'] },
      { id: 'pageheader', label: 'PageHeader', icon: HeadingIcon, components: ['page-header'] },
      { id: 'stepper', label: 'Stepper', icon: ListOrderedIcon, components: ['stepper'] },
    ],
  },
  {
    group: 'Routines',
    items: [
      { id: 'runhistory', label: 'RunHistory', icon: BarChart3Icon, components: ['run-history'] },
      { id: 'routinetable', label: 'RoutineTable', icon: TableIcon, components: ['routine-table'] },
      { id: 'runslist', label: 'RunsList', icon: ListIcon, components: ['runs-list'] },
      { id: 'templates', label: 'TemplateGrid', icon: LayoutGridIcon, components: ['template-grid'] },
      { id: 'routinesteps', label: 'RoutineSteps', icon: ListOrderedIcon, components: ['routine-steps', 'inline-token', 'time-grid'] },
    ],
  },
  {
    group: 'Settings',
    items: [
      { id: 'settingsshell', label: 'SettingsShell', icon: PanelTopIcon, components: ['settings-shell'] },
      { id: 'settingsnav', label: 'SettingsNav', icon: PanelLeftIcon, components: ['settings-nav'] },
      { id: 'settingsgroup', label: 'SettingsGroup', icon: RowsIcon, components: ['settings-group'] },
      { id: 'hostcard', label: 'HostCard', icon: CpuIcon, components: ['host-card'] },
    ],
  },
  {
    group: 'Terminal',
    items: [{ id: 'terminal', label: 'Terminal', icon: TerminalIcon, components: ['terminal'] }],
  },
  {
    group: 'Media',
    items: [{ id: 'carousel', label: 'ImageCarousel', icon: ImageIcon, components: ['image-carousel'] }],
  },
];

export const TOC_COUNT = TOC.filter((g) => g.group !== 'Foundations').reduce(
  (n, g) => n + g.items.length,
  0,
);

export const DURATIONS = [
  ['instant', '80ms', 'hover, press'],
  ['fast', '140ms', 'menus, tooltips'],
  ['base', '220ms', 'dialogs, sidebar collapse, theme change'],
  ['slow', '400ms', 'progress and chart fills'],
] as const;
