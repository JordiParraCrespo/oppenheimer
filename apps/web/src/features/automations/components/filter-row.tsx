import { PillTab, PillTabs, RunsListFilters } from '@oppenheimer/design-system-web';
import type * as React from 'react';

/**
 * The filter row above an automations list (the Runs tab, an automation's
 * runs, the Bot routines tab) and above its placeholder: the status pills on
 * the left, each with its count, and the facets the caller passes as children
 * on the right. The facets are one group, so when the row cannot hold them
 * they wrap together. `disabled` is the placeholder's: the pills are written
 * and their counts are whatever the caller hands in, bars while loading.
 */
export function FilterRow<Tab extends string>({
  tabs,
  value,
  label,
  count,
  disabled,
  onValueChange,
  children,
}: {
  tabs: readonly Tab[];
  value: Tab;
  label: (tab: Tab) => string;
  count: (tab: Tab) => React.ReactNode;
  disabled?: boolean;
  onValueChange?: (tab: Tab) => void;
  children?: React.ReactNode;
}) {
  return (
    <RunsListFilters>
      <PillTabs
        size="sm"
        value={value}
        onValueChange={(next) => onValueChange?.(next as Tab)}
        disabled={disabled}
      >
        {tabs.map((tab) => (
          <PillTab key={tab} value={tab} count={count(tab)}>
            {label(tab)}
          </PillTab>
        ))}
      </PillTabs>
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </RunsListFilters>
  );
}
