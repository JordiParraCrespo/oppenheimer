import * as PopoverPrimitive from '@rn-primitives/popover';
import { Check, ChevronDown, Search } from 'lucide-react-native';
import * as React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FadeIn, FadeOut } from 'react-native-reanimated';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';
import { cn } from '../../lib/utils';
import { Icon } from './icon';
import { NativeOnlyAnimatedView } from './native-only-animated-view';
import { Text, TextClassContext } from './text';

type ComboboxOption = {
  value: string;
  label: string;
  /** A second line under the label — searched as well as shown. */
  meta?: string;
  /** Rendered before the label, in both the row and the trigger. */
  icon?: React.ReactNode;
};

/** Rows rendered at a time; more are added as the list nears its end. */
const PAGE_SIZE = 50;
/** Matches the web control: long enough to skip a word, short enough to feel live. */
const DEBOUNCE_MS = 180;

const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

/**
 * Combobox — the *form* control for picking one value out of a list nobody
 * wants to scroll: teammates, tracked domains, anything whose length is a
 * property of the workspace rather than of the product. Same API as the web
 * component: it looks like a `Select` trigger, and what it adds is a search
 * box over the options.
 *
 * `value` is `null` for "nothing picked". Pass `clearLabel` to offer that as a
 * row — "Unassigned", "No domain" — which is also what the trigger then reads
 * when the value is null; without it the trigger shows `placeholder`.
 *
 * **Two ways to search.** With no `onQueryChange`, the query filters `options`
 * here. Pass `onQueryChange` and the query is yours to answer — debounced —
 * and `options` is taken as the answer and shown unfiltered. The picked option
 * is remembered even once a query pushes it out of the list.
 *
 * Rows are windowed at 50 and extended on scroll.
 *
 * Controlled: own `value` and handle `onValueChange`.
 */
function Combobox({
  options,
  value,
  onValueChange,
  onQueryChange,
  loading,
  placeholder,
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  loadingText = 'Searching…',
  clearLabel,
  disabled,
  invalid,
  size = 'default',
  className,
  contentClassName,
  portalHost,
}: {
  options: ComboboxOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  /**
   * Called with the typed query, debounced. Its presence means the caller is
   * fetching the options, so they are rendered as given rather than filtered
   * again here.
   */
  onQueryChange?: (query: string) => void;
  /** Shown in place of the list while a query has no options to draw yet. */
  loading?: boolean;
  /** Trigger text with nothing picked — ignored when `clearLabel` is given. */
  placeholder?: string;
  searchPlaceholder?: string;
  /** Shown in place of the list when the query matches nothing. */
  emptyText?: string;
  loadingText?: string;
  /** Label of the row that sets the value back to `null`. */
  clearLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  contentClassName?: string;
  portalHost?: string;
}) {
  const triggerRef = React.useRef<PopoverPrimitive.TriggerRef>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  const term = query.trim().toLowerCase();

  // Debounced, and only while open: a control the reader has closed should not
  // still be asking the API about the query they left in it.
  React.useEffect(() => {
    if (!onQueryChange) return;
    const timer = setTimeout(() => onQueryChange(open ? query.trim() : ''), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [onQueryChange, open, query]);

  const matches = React.useMemo(() => {
    if (onQueryChange || !term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) ||
        (option.meta ?? '').toLowerCase().includes(term),
    );
  }, [onQueryChange, options, term]);

  // The clear row is dropped once a query is typed: "Unassigned" is not an
  // answer to a search for a name.
  const rows = React.useMemo<(ComboboxOption | null)[]>(
    () => (clearLabel && !term ? [null, ...matches] : matches),
    [clearLabel, matches, term],
  );
  const visible = rows.slice(0, limit);

  // The picked option, kept across a narrowing of `options`, so a trigger does
  // not empty itself mid-search.
  const found = value === null ? null : (options.find((option) => option.value === value) ?? null);
  const remembered = React.useRef<ComboboxOption | null>(null);
  if (found && remembered.current?.value !== found.value) remembered.current = found;
  const selected =
    found ?? (value !== null && remembered.current?.value === value ? remembered.current : null);

  function choose(option: ComboboxOption | null) {
    onValueChange(option ? option.value : null);
    triggerRef.current?.close();
  }

  return (
    <PopoverPrimitive.Root
      onOpenChange={(next) => {
        setOpen(next);
        setLimit(PAGE_SIZE);
        // The query is per-opening. Keeping it would reopen the control onto a
        // filtered list, with the reason for it two taps in the past.
        if (!next) setQuery('');
      }}
    >
      <PopoverPrimitive.Trigger
        ref={triggerRef}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-invalid={invalid}
        className={cn(
          'w-full flex-row items-center justify-between gap-2 rounded-md border border-border-default bg-card px-3 py-2',
          size === 'sm' ? 'h-8' : size === 'lg' ? 'h-11' : 'h-10',
          open && 'border-ring',
          invalid && 'border-destructive',
          disabled && 'opacity-50',
          className,
        )}
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {selected?.icon}
          <Text
            numberOfLines={1}
            className={cn('flex-1 text-base', selected || clearLabel ? 'text-ink-900' : 'text-ink-400')}
          >
            {selected ? selected.label : (clearLabel ?? placeholder)}
          </Text>
        </View>
        <Icon
          as={ChevronDown}
          size={16}
          className={cn('shrink-0 text-ink-400', open && 'rotate-180')}
          aria-hidden
        />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal hostName={portalHost}>
        <FullWindowOverlay>
          <PopoverPrimitive.Overlay style={Platform.select({ native: StyleSheet.absoluteFill })}>
            <NativeOnlyAnimatedView entering={FadeIn.duration(200)} exiting={FadeOut}>
              <TextClassContext.Provider value="text-popover-foreground">
                <PopoverPrimitive.Content
                  align="start"
                  sideOffset={4}
                  className={cn(
                    'z-50 w-72 overflow-hidden rounded-2xl border border-border bg-popover shadow-md shadow-black/5',
                    contentClassName,
                  )}
                >
                  <View className="flex-row items-center gap-2 border-b border-border-subtle px-3 py-2.5">
                    <Icon as={Search} size={15} className="shrink-0 text-ink-400" aria-hidden />
                    <TextInput
                      autoFocus
                      value={query}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={undefined}
                      onChangeText={(next) => {
                        setQuery(next);
                        setLimit(PAGE_SIZE);
                      }}
                      className="min-w-0 flex-1 bg-transparent text-base text-ink-900 placeholder:text-ink-400"
                    />
                  </View>

                  {visible.length > 0 ? (
                    <FlatList
                      data={visible}
                      keyExtractor={(option) => (option ? option.value : '__clear__')}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      className="max-h-64"
                      contentContainerClassName="p-1.5"
                      onEndReachedThreshold={0.4}
                      onEndReached={() => {
                        if (limit < rows.length) setLimit((current) => current + PAGE_SIZE);
                      }}
                      renderItem={({ item: option }) => {
                        const on = option ? option.value === value : value === null;
                        return (
                          <Pressable
                            role="option"
                            aria-selected={on}
                            onPress={() => choose(option)}
                            className={cn(
                              'w-full flex-row items-center gap-2.5 rounded-md px-2.5 py-2 active:bg-surface-hover',
                              on && 'bg-surface-sunken',
                            )}
                          >
                            <View className="w-4 shrink-0 items-center">
                              {on ? (
                                <Icon as={Check} size={16} className="text-accent-blue" />
                              ) : null}
                            </View>
                            {option?.icon}
                            <View className="min-w-0 flex-1">
                              <Text numberOfLines={1} className="text-base text-ink-900">
                                {option ? <Highlight text={option.label} term={term} /> : clearLabel}
                              </Text>
                              {option?.meta ? (
                                <Text numberOfLines={1} className="text-xs text-ink-400">
                                  <Highlight text={option.meta} term={term} />
                                </Text>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      }}
                    />
                  ) : (
                    <View className="px-3 py-5">
                      <Text className="text-center text-sm text-ink-400">
                        {loading ? loadingText : emptyText}
                      </Text>
                    </View>
                  )}
                </PopoverPrimitive.Content>
              </TextClassContext.Provider>
            </NativeOnlyAnimatedView>
          </PopoverPrimitive.Overlay>
        </FullWindowOverlay>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * Internal — marks the matched run so the reader can see *why* a row survived
 * the query. Nested `Text` so it inherits the row's size and colour.
 */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const at = text.toLowerCase().indexOf(term);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Text className="rounded-[3px] bg-accent-blue/15 font-medium">
        {text.slice(at, at + term.length)}
      </Text>
      {text.slice(at + term.length)}
    </>
  );
}

export { Combobox, type ComboboxOption };
