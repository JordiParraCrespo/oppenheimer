import {
  AppWindowIcon,
  CircleDotIcon,
  CircleUserRoundIcon,
  CodeIcon,
  ImageIcon,
  KeyboardIcon,
  LayersIcon,
  LinkIcon,
  ListOrderedIcon,
  type LucideIcon,
  MenuIcon,
  MessageSquareIcon,
  MinusIcon,
  MousePointerClickIcon,
  PaletteIcon,
  PanelLeftIcon,
  RectangleHorizontalIcon,
  RulerIcon,
  ShapesIcon,
  SquareAsteriskIcon,
  SquareChevronDownIcon,
  SquareDashedIcon,
  SquareIcon,
  SquarePlusIcon,
  TagIcon,
  TerminalIcon,
  TextCursorInputIcon,
  TextIcon,
  TypeIcon,
  WavesIcon,
  ChevronDownCircleIcon,
} from 'lucide-react';

export type TocItem = { id: string; label: string; icon: LucideIcon };
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
      { id: 'colors', label: 'Colours', icon: PaletteIcon },
      { id: 'type', label: 'Typography', icon: TypeIcon },
      { id: 'space', label: 'Space', icon: RulerIcon },
      { id: 'radius', label: 'Radii', icon: SquareIcon },
      { id: 'elevation', label: 'Elevation', icon: LayersIcon },
      { id: 'motion', label: 'Motion', icon: WavesIcon },
      { id: 'icons', label: 'Icons', icon: ShapesIcon },
    ],
  },
  {
    group: 'Core',
    items: [
      { id: 'wordmark', label: 'Wordmark', icon: SquareAsteriskIcon },
      { id: 'buttons', label: 'Button', icon: MousePointerClickIcon },
      { id: 'iconbuttons', label: 'IconButton', icon: SquarePlusIcon },
      { id: 'links', label: 'Link', icon: LinkIcon },
      { id: 'chips', label: 'Chip', icon: TagIcon },
      { id: 'statusdot', label: 'StatusDot', icon: CircleDotIcon },
      { id: 'avatars', label: 'Avatar', icon: CircleUserRoundIcon },
      { id: 'separators', label: 'Separator', icon: MinusIcon },
      { id: 'kbd', label: 'Kbd', icon: KeyboardIcon },
      { id: 'cards', label: 'Card', icon: RectangleHorizontalIcon },
      { id: 'codeblock', label: 'CodeBlock', icon: CodeIcon },
      { id: 'emptystate', label: 'EmptyState', icon: SquareDashedIcon },
    ],
  },
  {
    group: 'Forms',
    items: [
      { id: 'fields', label: 'Field & Input', icon: TextCursorInputIcon },
      { id: 'textarea', label: 'Textarea', icon: TextIcon },
      { id: 'chipselect', label: 'ChipSelect', icon: SquareChevronDownIcon },
      { id: 'composer', label: 'Composer', icon: MessageSquareIcon },
    ],
  },
  {
    group: 'Overlays',
    items: [
      { id: 'dialog', label: 'Dialog', icon: AppWindowIcon },
      { id: 'dropdown', label: 'DropdownMenu', icon: MenuIcon },
      { id: 'tooltip', label: 'Tooltip', icon: ChevronDownCircleIcon },
    ],
  },
  {
    group: 'Navigation',
    items: [
      { id: 'sidebar', label: 'Sidebar', icon: PanelLeftIcon },
      { id: 'stepper', label: 'Stepper', icon: ListOrderedIcon },
    ],
  },
  {
    group: 'Terminal',
    items: [{ id: 'terminal', label: 'Terminal', icon: TerminalIcon }],
  },
  {
    group: 'Media',
    items: [{ id: 'carousel', label: 'ImageCarousel', icon: ImageIcon }],
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
