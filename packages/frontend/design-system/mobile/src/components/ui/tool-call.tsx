import * as CollapsiblePrimitive from '@rn-primitives/collapsible';
import { AlertTriangle, Check, ChevronDown, Loader2 } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { cn } from '../../lib/utils';
import { Icon } from './icon';
import { Text, TextClassContext } from './text';

/**
 * ToolCall — one step an assistant took, folded away by default.
 *
 * The row is the claim ("Listed domains · 5 results"); the panel is the
 * evidence. Compose it — the root only carries the status, and each part
 * decides what it renders:
 *
 * ```tsx
 * <ToolCall status="complete">
 *   <ToolCallTrigger>
 *     <ToolCallIcon><Icon as={Globe} /></ToolCallIcon>
 *     <ToolCallLabel>domains_list</ToolCallLabel>
 *     <ToolCallSummary>5 results</ToolCallSummary>
 *     <ToolCallIndicator />
 *   </ToolCallTrigger>
 *   <ToolCallContent>
 *     <ToolCallPayload>{JSON.stringify(args, null, 2)}</ToolCallPayload>
 *   </ToolCallContent>
 * </ToolCall>
 * ```
 *
 * The root owns the open state (controlled through `open`/`onOpenChange`, or
 * uncontrolled from `defaultOpen`) rather than leaving it to the primitive,
 * because the trigger's chevron needs to know which way to point and the
 * primitive exposes no `data-panel-open` for a class to key off.
 */
type ToolCallStatus = 'running' | 'complete' | 'error';

const ToolCallContext = React.createContext<{ status: ToolCallStatus; open: boolean }>({
  status: 'complete',
  open: false,
});

function ToolCall({
  status = 'complete',
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root> & { status?: ToolCallStatus }) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;

  function handleOpenChange(next: boolean) {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <ToolCallContext.Provider value={{ status, open }}>
      <CollapsiblePrimitive.Root
        open={open}
        onOpenChange={handleOpenChange}
        className={cn(
          'w-full overflow-hidden rounded-xl border border-border-subtle bg-card',
          className,
        )}
        {...props}
      />
    </ToolCallContext.Provider>
  );
}

/** The always-visible row. Folds the panel open; carries its own chevron. */
function ToolCallTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  const { open } = React.useContext(ToolCallContext);

  return (
    <CollapsiblePrimitive.Trigger
      className={cn('w-full flex-row items-center gap-2.5 px-3 py-2.5 active:bg-surface-hover', className)}
      {...props}
    >
      <>
        {children}
        <Icon
          as={ChevronDown}
          className={cn('shrink-0 text-ink-400', open && 'rotate-180')}
          size={14}
          aria-hidden
        />
      </>
    </CollapsiblePrimitive.Trigger>
  );
}

/** The 24px tile the tool's glyph sits in. */
function ToolCallIcon({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <TextClassContext.Provider value="text-ink-600">
      <View
        className={cn(
          'size-6 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-canvas',
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

/** The tool's name. Kept as the API writes it — `domains_list`, not "Domains". */
function ToolCallLabel({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      numberOfLines={1}
      className={cn('shrink text-sm font-medium text-ink-900', className)}
      {...props}
    />
  );
}

/** The one-line outcome beside the name: a count, a target, a reason. */
function ToolCallSummary({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      numberOfLines={1}
      className={cn('min-w-0 flex-1 text-sm text-ink-400', className)}
      {...props}
    />
  );
}

/**
 * The status glyph, read from the root: a spinner while the call is in flight,
 * a tick when it lands, a warning when it fails. Silent by default — pass
 * children to label it for a reader who cannot tell three small marks apart.
 */
function ToolCallIndicator({
  className,
  children,
  ...props
}: React.ComponentProps<typeof View>) {
  const { status } = React.useContext(ToolCallContext);
  const tone = status === 'error' ? 'text-status-ended' : 'text-ink-400';

  return (
    <TextClassContext.Provider value={cn('text-xs', tone)}>
      <View className={cn('shrink-0 flex-row items-center gap-1.5', className)} {...props}>
        {status === 'running' ? (
          <Icon as={Loader2} size={14} className={cn(tone, 'animate-spin')} />
        ) : status === 'error' ? (
          <Icon as={AlertTriangle} size={14} className={tone} />
        ) : (
          <Icon as={Check} size={14} className="text-status-active" />
        )}
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </View>
    </TextClassContext.Provider>
  );
}

/** The panel: arguments, the returned payload, whatever the step is evidence of. */
function ToolCallContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <TextClassContext.Provider value="text-sm text-ink-600">
      <CollapsiblePrimitive.Content
        className={cn('flex-col gap-2 border-t border-border-subtle px-3 py-2.5', className)}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

/**
 * A serialized blob inside the panel. Scrolls in itself and caps its height:
 * a tool that returns two hundred rows must not push the answer off screen.
 */
function ToolCallPayload({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof ScrollView>, 'children'> & { children?: string }) {
  return (
    <ScrollView
      nestedScrollEnabled
      className={cn('max-h-60 rounded-lg bg-surface-sunken', className)}
      contentContainerClassName="p-2.5"
      {...props}
    >
      <ScrollView horizontal nestedScrollEnabled>
        <Text className="font-mono text-xs leading-normal text-ink-600">{children}</Text>
      </ScrollView>
    </ScrollView>
  );
}

export type { ToolCallStatus };
export {
  ToolCall,
  ToolCallContent,
  ToolCallIcon,
  ToolCallIndicator,
  ToolCallLabel,
  ToolCallPayload,
  ToolCallSummary,
  ToolCallTrigger,
};
