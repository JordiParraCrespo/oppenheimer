import { X } from 'lucide-react-native';
import type * as React from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '../../lib/utils';
import { Icon } from './icon';
import { Text } from './text';

/**
 * MailboxTag — the quiet pill naming the mailbox a message arrived in, with
 * that mailbox's purpose dot in front of it. Sits inside a message row and in
 * the reading pane's header.
 *
 * Read-only by design. This is a label, not a control; the removable form is
 * `MailboxChip`.
 */
function MailboxTag({
  tone,
  children,
  className,
  ...props
}: React.ComponentProps<typeof View> & { tone?: string }) {
  return (
    <View
      className={cn(
        'shrink-0 flex-row items-center gap-[5px] rounded-full border border-border-subtle bg-surface-sunken px-2 py-0.5',
        className,
      )}
      {...props}
    >
      <View
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-ink-400"
        style={tone ? { backgroundColor: tone } : undefined}
      />
      <Text numberOfLines={1} className="text-[11.5px] text-ink-600">
        {children}
      </Text>
    </View>
  );
}

/**
 * MailboxChip — one mailbox in the toolbar's "currently filtering by" row,
 * with the control that drops it. The whole chip is not pressable, only the ✕.
 */
function MailboxChip({
  tone,
  onRemove,
  removeLabel = 'Remove',
  children,
  className,
  ...props
}: React.ComponentProps<typeof View> & {
  tone?: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-1.5 rounded-full border border-border-subtle bg-surface-sunken py-1 pl-2.5 pr-1.5',
        className,
      )}
      {...props}
    >
      <View
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-ink-400"
        style={tone ? { backgroundColor: tone } : undefined}
      />
      <Text numberOfLines={1} className="text-xs text-ink-900">
        {children}
      </Text>
      {onRemove ? (
        <Pressable
          aria-label={removeLabel}
          hitSlop={6}
          onPress={onRemove}
          className="size-[17px] shrink-0 items-center justify-center rounded-full active:bg-surface-hover"
        >
          <Icon as={X} size={11} className="text-ink-400" />
        </Pressable>
      ) : null}
    </View>
  );
}

export { MailboxChip, MailboxTag };
