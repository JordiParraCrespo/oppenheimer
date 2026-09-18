import type React from 'react';
import AccordionScreen from './accordion';
import AlertScreen from './alert';
import AlertDialogScreen from './alert-dialog';
import ApprovalScreen from './approval';
import AspectRatioScreen from './aspect-ratio';
import AvatarScreen from './avatar';
import BadgeScreen from './badge';
import BrandMarkScreen from './brand-mark';
import ButtonScreen from './button';
import CardScreen from './card';
import ChatMarkdownScreen from './chat-markdown';
import CheckboxScreen from './checkbox';
import CollapsibleScreen from './collapsible';
import ComboboxScreen from './combobox';
import ContextMenuScreen from './context-menu';
import DialogScreen from './dialog';
import DropdownMenuScreen from './dropdown-menu';
import EmptyStateScreen from './empty-state';
import FilterMenuScreen from './filter-menu';
import HoverCardScreen from './hover-card';
import InputScreen from './input';
import LabelScreen from './label';
import MailboxTagScreen from './mailbox-tag';
import MenubarScreen from './menubar';
import MessageListScreen from './message-list';
import MessageReaderScreen from './message-reader';
import PopoverScreen from './popover';
import ProgressScreen from './progress';
import RadioGroupScreen from './radio-group';
import ReplyBoxScreen from './reply-box';
import SelectScreen from './select';
import SeparatorScreen from './separator';
import SkeletonScreen from './skeleton';
import StageBreakdownScreen from './stage-breakdown';
import SwitchScreen from './switch';
import TabsScreen from './tabs';
import TextScreen from './text';
import TextareaScreen from './textarea';
import ToggleScreen from './toggle';
import ToggleGroupScreen from './toggle-group';
import ToolCallScreen from './tool-call';
import TooltipScreen from './tooltip';

export const REGISTRY: Record<string, React.ComponentType> = {
  accordion: AccordionScreen,
  alert: AlertScreen,
  'alert-dialog': AlertDialogScreen,
  approval: ApprovalScreen,
  'aspect-ratio': AspectRatioScreen,
  avatar: AvatarScreen,
  badge: BadgeScreen,
  'brand-mark': BrandMarkScreen,
  button: ButtonScreen,
  card: CardScreen,
  'chat-markdown': ChatMarkdownScreen,
  checkbox: CheckboxScreen,
  collapsible: CollapsibleScreen,
  combobox: ComboboxScreen,
  'context-menu': ContextMenuScreen,
  dialog: DialogScreen,
  'dropdown-menu': DropdownMenuScreen,
  'empty-state': EmptyStateScreen,
  'filter-menu': FilterMenuScreen,
  'hover-card': HoverCardScreen,
  input: InputScreen,
  label: LabelScreen,
  'mailbox-tag': MailboxTagScreen,
  menubar: MenubarScreen,
  'message-list': MessageListScreen,
  'message-reader': MessageReaderScreen,
  popover: PopoverScreen,
  progress: ProgressScreen,
  'radio-group': RadioGroupScreen,
  'reply-box': ReplyBoxScreen,
  select: SelectScreen,
  separator: SeparatorScreen,
  skeleton: SkeletonScreen,
  'stage-breakdown': StageBreakdownScreen,
  switch: SwitchScreen,
  tabs: TabsScreen,
  text: TextScreen,
  textarea: TextareaScreen,
  toggle: ToggleScreen,
  'toggle-group': ToggleGroupScreen,
  'tool-call': ToolCallScreen,
  tooltip: TooltipScreen,
};
