export type { AgentId } from './components/agent-mark';
export { AgentMark } from './components/agent-mark';
export type { AgentModel, AgentOption, Engine } from './components/agent-model-select';
export { AgentModelSelect } from './components/agent-model-select';
export type { AlertTone } from './components/alert';
export {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from './components/alert';
export type { AvatarGradient } from './components/avatar';
export {
  AVATAR_GRADIENTS,
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from './components/avatar';
export { Badge, badgeVariants } from './components/badge';
export type { BrandGlyphName } from './components/brand-glyph';
/* ── MVP design system (product/versions/mvp/design) ───────────────────── */
export { BrandGlyph } from './components/brand-glyph';
export { BrandMark } from './components/brand-mark';
export type { ButtonProps } from './components/button';
export { Button, buttonVariants } from './components/button';
export { CalendarLayerItem, CalendarSourceCard } from './components/calendar-source';
export type { CalloutTone } from './components/callout';
export { Callout } from './components/callout';
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/card';
export type { BarDatum, ChartSeries, DataTone, LinePoint } from './components/charts';
export {
  BarChart,
  BarList,
  ChartHero,
  ChartLegend,
  ChartRow,
  LineChart,
  RingChart,
} from './components/charts';
export { Checkbox } from './components/checkbox';
export type { ChipProps } from './components/chip';
export { Chip, chipVariants, FilterChip } from './components/chip';
export type {
  ChipSelectAction,
  ChipSelectDensity,
  ChipSelectOption,
  ChipSelectTriggerVariant,
} from './components/chip-select';
export {
  ChipSelect,
  ChipSelectActionRow,
  ChipSelectBack,
  ChipSelectEmpty,
  ChipSelectItem,
  ChipSelectList,
  ChipSelectPopup,
  ChipSelectSearch,
  ChipSelectTrigger,
} from './components/chip-select';
export type { CodeBlockTab } from './components/code-block';
export { CodeBlock } from './components/code-block';
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './components/command';
export type { CommandRowSurface } from './components/command-row';
export { CommandRow, CommandRowList } from './components/command-row';
export type { ComposerAttachment, ComposerLabels } from './components/composer';
export { Composer, ComposerToolButton } from './components/composer';
export { DatePicker } from './components/date-picker';
export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHero,
  DialogHeroPlate,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/dialog';
export type { DiffTreeFile } from './components/diff-file-tree';
export { DiffFileTree } from './components/diff-file-tree';
export { DiffStat, diffStatParts } from './components/diff-stat';
export type { DiffAnnotation, DiffLayout } from './components/diff-view';
export {
  DiffComment,
  DiffCommentDraft,
  DiffCommentLink,
  DiffFile,
  DiffFileHeader,
  DiffView,
} from './components/diff-view';
export { Disclosure, DisclosurePanel, DisclosureTrigger } from './components/disclosure';
export type {
  DragData,
  DragItem,
  DragLabels,
  DragMove,
  SortableGroups,
  SortableOrientation,
} from './components/drag';
export {
  DragProvider,
  DropSlot,
  dragIgnore,
  SortableGroup,
  SortableItem,
  useDraggable,
  useDroppable,
  useSortableControl,
  useSortableGroups,
  useSortableItem,
} from './components/drag';
export { DropZone } from './components/drop-zone';
export {
  DropdownMenu,
  DropdownMenuBack,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPaneItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuValue,
} from './components/dropdown-menu';
export type { EditorPageSize } from './components/editor-page';
export {
  EditorPage,
  EditorPageBack,
  EditorPageBody,
  EditorPageTop,
} from './components/editor-page';
export type { EffortStop } from './components/effort-slider';
export { EffortPicker, EffortSlider } from './components/effort-slider';
export { EmptyState } from './components/empty-state';
export {
  Field,
  FieldAction,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldRow,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from './components/field';
export type { FieldSelectOption } from './components/field-select';
export { FieldSelect, FieldSelectGroup, FieldSelectRow } from './components/field-select';
export { FileIcon } from './components/file-icon';
export { GoalCard, GoalEmpty, GoalGrid } from './components/goal-card';
export type { HostCardOffline, HostCardStatus } from './components/host-card';
export { HostCard } from './components/host-card';
export type { HostLinkForm, HostLinkLabels, HostLinkPhase } from './components/host-link';
export { HostLinkChrome } from './components/host-link';
export type { IconButtonProps } from './components/icon-button';
export { IconButton, iconButtonVariants } from './components/icon-button';
export type { CarouselSlide } from './components/image-carousel';
export { ImageCarousel } from './components/image-carousel';
export {
  AddRow,
  InlineToken,
  TokenLiveDot,
  TokenMono,
  TokenSentence,
  TriggerCard,
  WeekdayStrip,
} from './components/inline-token';
export type { InputProps } from './components/input';
export { Input, inputVariants } from './components/input';
export { Kbd } from './components/kbd';
export { Link } from './components/link';
export { MergePath } from './components/merge-path';
export type { CalendarEntryData, CalendarEntryKind } from './components/month-calendar';
export { CalendarEntry, MonthCalendar } from './components/month-calendar';
export {
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderMeta,
  PageHeaderNote,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderStat,
  PageHeaderTitleInput,
} from './components/page-header';
export { Panel, PanelGrid } from './components/panel';
export { PasswordInput } from './components/password-input';
export type { PermissionLevel, PermissionOption } from './components/permission-menu';
export { PermissionMenu } from './components/permission-menu';
export type { PillTabsSize } from './components/pill-tabs';
export { PillTab, PillTabs } from './components/pill-tabs';
export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from './components/popover';
export { Prose } from './components/prose';
export { PullRequestHeader } from './components/pull-request-header';
export {
  MergeButton,
  PullRequestRow,
  PullRequestTable,
  PullRequestTableHead,
} from './components/pull-request-table';
export { RadioGroup, RadioGroupItem } from './components/radio-group';
export { Rail, RailItem, RailMark, SortableRailItem } from './components/rail';
export type { RepositoryAddOption } from './components/repository-add-field';
export { RepositoryAddField } from './components/repository-add-field';
export type {
  RepositoryRowBranch,
  RepositoryRowOption,
  RepositoryRowValue,
} from './components/repository-row-list';
export { RepositoryRowList } from './components/repository-row-list';
export type {
  RepositoryBranch,
  RepositoryOption,
  RepositoryScope,
} from './components/repository-select';
export { RepositorySelect } from './components/repository-select';
export type { ReviewVerdict } from './components/review-decision';
export { ReviewDecision, SubmitReviewButton } from './components/review-decision';
export type { RoutineRunState } from './components/routine-item';
export {
  RoutineItem,
  RoutineRun,
  RoutineRunList,
  RoutineRunsEmpty,
} from './components/routine-item';
export { RoutineStep, RoutineStepFields, RoutineSteps } from './components/routine-steps';
export {
  RoutineTable,
  RoutineTableEmpty,
  RoutineTableHead,
  RoutineTableRow,
} from './components/routine-table';
export type { RunHistoryDay } from './components/run-history';
export { RunHistory } from './components/run-history';
export type { RunState } from './components/runs-list';
export {
  RunRow,
  RunsList,
  RunsListEmpty,
  RunsListFilters,
  RunsListFoot,
  RunsListHead,
} from './components/runs-list';
export { SegmentedControl, SegmentedControlItem } from './components/segmented-control';
export { Separator } from './components/separator';
export type { SessionRename } from './components/session-item';
export { SessionItem, SessionList, SortableSessionItem } from './components/session-item';
export { SessionPaneBack, SessionPaneHeader } from './components/session-pane-header';
export {
  SettingsForm,
  SettingsGroup,
  SettingsHeading,
  SettingsRow,
  SettingsSaveRow,
} from './components/settings-group';
export {
  SettingsNav,
  SettingsNavBack,
  SettingsNavGroup,
  SettingsNavItem,
} from './components/settings-nav';
export {
  SettingsContent,
  SettingsMain,
  SettingsShell,
  SettingsTitle,
} from './components/settings-shell';
export {
  Sidebar,
  SidebarContent,
  SidebarEmptyRow,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupCount,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarListHead,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SidebarProvider,
  SidebarRail,
  SidebarSearch,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from './components/sidebar';
export { Skeleton } from './components/skeleton';
export type { SlugStatus } from './components/slug-input';
export { SlugInput } from './components/slug-input';
export { Toaster, toast } from './components/sonner';
export { FactGrid, FactTile, StatBar, StatCard, StatDelta } from './components/stat-card';
export type { StatusState } from './components/status-dot';
export { dotVariants, STATUS_LABEL, StatusDot } from './components/status-dot';
export { StepHeader } from './components/step-header';
export type { Step, StepState } from './components/stepper';
export { Stepper } from './components/stepper';
export { SuccessMark } from './components/success-mark';
export { SummaryCard, SummaryRow } from './components/summary-card';
export type { TaskDueTone, TaskStatus } from './components/task-board';
export {
  TASK_STATUS_STATE,
  TaskBoard,
  TaskCard,
  TaskColumn,
  TaskColumnAdd,
  TaskComposer,
  TaskSessionChip,
} from './components/task-board';
export { TemplateGrid, TemplateItem } from './components/template-grid';
export type { TerminalHostLink, TerminalLinkState, TerminalTone } from './components/terminal';
export {
  Terminal,
  TerminalLine,
  TerminalPrompt,
  TerminalScrollback,
  TerminalSpacer,
  TerminalStatusBar,
  TerminalStatusItem,
  TerminalStatusLink,
  TerminalTurn,
} from './components/terminal';
export { Textarea } from './components/textarea';
export type { TimeGridCell, TimeGridGroup } from './components/time-grid';
export { TimeGrid } from './components/time-grid';
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './components/tooltip';
export { Wordmark } from './components/wordmark';
export { useControlled } from './hooks/use-controlled';
export { useCopy } from './hooks/use-copy';
export { useDebouncedCallback } from './hooks/use-debounced-callback';
export { useDebouncedValue } from './hooks/use-debounced-value';
export { useFileDrag } from './hooks/use-file-drag';
export { useIsMobile } from './hooks/use-mobile';
export { useNow } from './hooks/use-now';
export { cn } from './lib/utils';
