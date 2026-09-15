import { ChevronRight } from 'lucide-react-native';
import type * as React from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '../../lib/utils';
import { Icon } from './icon';
import { Text, TextClassContext } from './text';

/**
 * The reading pane's contents: subject, who sent it, the body, whatever came
 * attached, and any record the message is linked to.
 *
 * Only the contents. The screen around them — the pager, the archive and
 * delete controls — belongs to the app's route, as the web's belongs to a
 * `Sheet`.
 */
function MessageReader({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn(className)} {...props} />;
}

/** Subject and sender, ruled off from the body below. */
function MessageReaderHeader({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn('mb-[18px] border-b border-border-subtle pb-[18px] pt-0.5', className)}
      {...props}
    />
  );
}

/** The subject line — the screen's heading. */
function MessageReaderSubject({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      role="heading"
      aria-level="1"
      className={cn('mb-3 text-2xl font-medium leading-tight text-ink-900', className)}
      {...props}
    />
  );
}

/** The row under the subject: avatar, identity, mailbox tag, time. */
function MessageReaderMeta({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    // Wraps rather than squeezing: the mailbox tag carries a full address and
    // a phone is never wide enough for four things on one line.
    <View
      className={cn('flex-row flex-wrap items-center gap-x-[11px] gap-y-2', className)}
      {...props}
    />
  );
}

/**
 * Sender name over their address. Both truncate — a long address is still
 * recognisable from its start — and the block keeps a floor width so that a
 * wide mailbox tag beside it wraps the row rather than crushing the name.
 */
function MessageReaderIdentity({
  name,
  address,
  className,
  ...props
}: React.ComponentProps<typeof View> & {
  name: React.ReactNode;
  address?: React.ReactNode;
}) {
  return (
    <View className={cn('min-w-32 flex-1', className)} {...props}>
      <Text numberOfLines={1} className="text-base font-medium text-ink-900">
        {name}
      </Text>
      {address ? (
        <Text numberOfLines={1} className="mt-0.5 text-xs text-ink-400">
          {address}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The message body. Paragraphs are spaced by the container, so the caller can
 * map over the message's own paragraphs as `Text` children without styling
 * each one.
 */
function MessageReaderBody({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <TextClassContext.Provider value="text-base leading-[1.6] text-ink-900">
      <View className={cn('gap-3.5', className)} {...props} />
    </TextClassContext.Provider>
  );
}

/**
 * A file that came with the message: type icon, name, size, and room on the
 * right for the download control. Never mid-upload — that is the composer's
 * `Attachment`.
 */
function MessageAttachment({
  icon,
  name,
  size,
  action,
  className,
  ...props
}: React.ComponentProps<typeof View> & {
  icon?: React.ReactNode;
  name: React.ReactNode;
  size?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <View
      className={cn(
        'mt-3.5 flex-row items-center gap-2.5 rounded-md border border-border-subtle px-3 py-2.5',
        className,
      )}
      {...props}
    >
      {icon}
      <Text numberOfLines={1} className="min-w-0 flex-1 text-sm text-ink-900">
        {name}
      </Text>
      {size ? <Text className="shrink-0 text-xs text-ink-400">{size}</Text> : null}
      {action}
    </View>
  );
}

/**
 * The row tying a message to a record elsewhere in the workspace — the lead it
 * came from, most often. Takes `onPress` so the caller supplies the router's
 * own navigation: the design system has no router.
 */
function MessageReaderLink({
  icon,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Pressable> & { icon?: React.ReactNode }) {
  return (
    <Pressable
      role="link"
      className={cn(
        'mt-4 flex-row items-center gap-2.5 rounded-md border border-border-subtle px-3 py-2.5 active:bg-surface-hover',
        className,
      )}
      {...props}
    >
      {icon}
      <Text numberOfLines={1} className="min-w-0 flex-1 text-sm text-ink-600">
        {children as React.ReactNode}
      </Text>
      <Icon as={ChevronRight} size={14} className="text-ink-400" />
    </Pressable>
  );
}

export {
  MessageAttachment,
  MessageReader,
  MessageReaderBody,
  MessageReaderHeader,
  MessageReaderIdentity,
  MessageReaderLink,
  MessageReaderMeta,
  MessageReaderSubject,
};
