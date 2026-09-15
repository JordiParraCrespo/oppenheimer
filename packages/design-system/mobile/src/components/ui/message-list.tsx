import type * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { cn } from '../../lib/utils';
import { Text, TextClassContext } from './text';

/**
 * MessageList — the scrolling column of message rows.
 *
 * Owns the scroll; the rows own everything else. Give it `flex-1` room from
 * the screen around it, or the list will grow the page instead of scrolling
 * inside it. A screen with thousands of rows should reach for `FlatList` and
 * render `MessageListItem` from `renderItem` instead.
 */
function MessageList({ className, ...props }: React.ComponentProps<typeof ScrollView>) {
  return <ScrollView className={cn('min-h-0 flex-1', className)} {...props} />;
}

/**
 * MessageListItem — one message: unread dot, avatar, sender over subject over
 * preview, and the time with its indicator icons on the right.
 *
 * Unread is the *lit* state, not the bold one alone — the row lifts to the
 * card white against the pane, takes the blue dot, and sets sender and subject
 * in medium. Three signals for one fact, because the row is scanned, not read.
 *
 * `avatar`, `tag` and `indicators` are slots so this component never has to
 * know about `Avatar`, `MailboxTag` or which icons mean what.
 */
function MessageListItem({
  avatar,
  from,
  tag,
  subject,
  preview,
  time,
  indicators,
  unread = false,
  selected = false,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Pressable>, 'children'> & {
  avatar?: React.ReactNode;
  from: React.ReactNode;
  tag?: React.ReactNode;
  subject: React.ReactNode;
  preview?: React.ReactNode;
  time?: React.ReactNode;
  indicators?: React.ReactNode;
  unread?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      aria-selected={selected}
      className={cn(
        'w-full flex-row items-center gap-3 border-b border-border-subtle px-4 py-3 active:bg-surface-hover',
        // Branched rather than stacked: the open message has to read as open
        // whether or not it is also unread.
        selected ? 'bg-focus-ring' : unread ? 'bg-card' : undefined,
        className,
      )}
      {...props}
    >
      <View
        aria-hidden
        className={cn('size-[7px] shrink-0 rounded-full', unread ? 'bg-accent-blue' : 'bg-transparent')}
      />
      {avatar ? <View className="shrink-0">{avatar}</View> : null}
      <View className="min-w-0 flex-1 overflow-hidden">
        <View className="min-w-0 flex-row items-center gap-[9px] overflow-hidden">
          <Text
            numberOfLines={1}
            className={cn('max-w-[180px] shrink text-base text-ink-900', unread && 'font-medium')}
          >
            {from}
          </Text>
          {tag}
        </View>
        <Text
          numberOfLines={1}
          className={cn('mt-[3px] text-base text-ink-900', unread && 'font-medium')}
        >
          {subject}
        </Text>
        {preview ? (
          <Text numberOfLines={1} className="mt-0.5 text-sm text-ink-400">
            {preview}
          </Text>
        ) : null}
      </View>
      <View className="min-w-[74px] shrink-0 flex-col items-end gap-1.5 pl-1.5">
        {time ? <Text className="text-xs text-ink-400">{time}</Text> : null}
        {indicators ? (
          <TextClassContext.Provider value="text-ink-400">
            <View className="flex-row items-center gap-1.5">{indicators}</View>
          </TextClassContext.Provider>
        ) : null}
      </View>
    </Pressable>
  );
}

export { MessageList, MessageListItem };
