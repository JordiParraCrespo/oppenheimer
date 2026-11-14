import * as React from 'react';
import { View } from 'react-native';
import { cn } from '../../lib/utils';
import { Text, TextClassContext } from './text';

/**
 * Approval — an action the assistant proposed and will not take until somebody
 * says yes. Same parts and status vocabulary as the web component:
 *
 * ```tsx
 * <Approval status="pending">
 *   <ApprovalHeader>
 *     <ApprovalIcon><Icon as={ShieldAlert} /></ApprovalIcon>
 *     <View className="flex-1">
 *       <ApprovalTitle>Pause 3 domains</ApprovalTitle>
 *       <ApprovalDescription>domains_set_status</ApprovalDescription>
 *     </View>
 *   </ApprovalHeader>
 *   <ApprovalDetails>
 *     <ApprovalDetail label="Status">paused</ApprovalDetail>
 *   </ApprovalDetails>
 *   <ApprovalActions>…</ApprovalActions>
 * </Approval>
 * ```
 */
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

const ApprovalContext = React.createContext<ApprovalStatus>('pending');

function Approval({
  status = 'pending',
  className,
  ...props
}: React.ComponentProps<typeof View> & { status?: ApprovalStatus }) {
  return (
    <ApprovalContext.Provider value={status}>
      <View
        className={cn(
          'w-full flex-col gap-3 rounded-2xl border border-border-default bg-card p-3.5',
          // A resolved proposal is history: it stays readable, but it stops
          // competing with the live turn underneath it.
          status !== 'pending' && 'border-border-subtle bg-surface-canvas',
          className,
        )}
        {...props}
      />
    </ApprovalContext.Provider>
  );
}

function ApprovalHeader({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('min-w-0 flex-row items-start gap-3', className)} {...props} />;
}

/** The 32px tile the action's glyph sits in. */
function ApprovalIcon({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <TextClassContext.Provider value="text-ink-600">
      <View
        className={cn(
          'size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-canvas',
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

/** What will happen, in the reader's words — "Pause 3 domains", not a tool name. */
function ApprovalTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn('text-base font-medium text-ink-900', className)} {...props} />;
}

/** The tool behind it, or the one line of context the title left out. */
function ApprovalDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn('mt-0.5 text-sm text-ink-600', className)} {...props} />;
}

/** The arguments, spelled out. A hairline-separated list, never a JSON blob. */
function ApprovalDetails({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn('overflow-hidden rounded-lg border border-border-subtle', className)}
      {...props}
    />
  );
}

function ApprovalDetail({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<typeof View> & { label: React.ReactNode }) {
  return (
    <View
      className={cn(
        'flex-row items-baseline gap-3 border-b border-border-subtle px-2.5 py-2 last:border-b-0',
        className,
      )}
      {...props}
    >
      <Text className="w-24 shrink-0 text-sm text-ink-400">{label}</Text>
      <Text numberOfLines={1} className="min-w-0 flex-1 text-sm text-ink-900">
        {children}
      </Text>
    </View>
  );
}

/** The buttons. Rendered only while the proposal is live — resolve it with `ApprovalOutcome`. */
function ApprovalActions({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('flex-row items-center gap-2', className)} {...props} />;
}

/**
 * What became of it, once it is no longer pending. Coloured from the root's
 * status so the two can never disagree.
 */
function ApprovalOutcome({ className, ...props }: React.ComponentProps<typeof Text>) {
  const status = React.useContext(ApprovalContext);

  return (
    <Text
      className={cn(
        'text-sm',
        status === 'approved'
          ? 'text-status-active'
          : status === 'rejected'
            ? 'text-status-ended'
            : 'text-ink-400',
        className,
      )}
      {...props}
    />
  );
}

export type { ApprovalStatus };
export {
  Approval,
  ApprovalActions,
  ApprovalDescription,
  ApprovalDetail,
  ApprovalDetails,
  ApprovalHeader,
  ApprovalIcon,
  ApprovalOutcome,
  ApprovalTitle,
};
