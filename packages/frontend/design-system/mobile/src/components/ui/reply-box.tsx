import type * as React from 'react';
import { TextInput, View } from 'react-native';
import { cn } from '../../lib/utils';

/**
 * ReplyBox — the reply well at the foot of a message: a card-radius frame
 * holding a plain multiline input over a sunken toolbar strip.
 *
 * A reply is a letter, not a prompt: it is multi-paragraph by default, Return
 * inserts a newline, and the send control is the workspace's ordinary CTA.
 *
 * Controlled: own `value`, handle `onValueChange`. `toolbar` fills the left of
 * the footer strip (attach, draft-with-AI), `actions` the right (send).
 */
function ReplyBox({
  value,
  onValueChange,
  placeholder,
  toolbar,
  actions,
  className,
  textareaClassName,
  ...props
}: React.ComponentProps<typeof View> & {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
  textareaClassName?: string;
}) {
  return (
    <View
      className={cn('mt-[22px] overflow-hidden rounded-2xl border border-border-default', className)}
      {...props}
    >
      <TextInput
        multiline
        textAlignVertical="top"
        value={value}
        placeholder={placeholder}
        onChangeText={onValueChange}
        className={cn(
          'min-h-[88px] w-full bg-transparent p-3 text-base leading-normal text-ink-900 placeholder:text-ink-400',
          textareaClassName,
        )}
      />
      <View className="flex-row items-center gap-2 border-t border-border-subtle bg-surface-sunken px-2.5 py-2">
        {toolbar}
        <View className="flex-1" />
        {actions}
      </View>
    </View>
  );
}

export { ReplyBox };
