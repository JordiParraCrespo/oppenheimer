'use client';

import {
  ChevronDownIcon,
  ChevronRightIcon,
  CircleQuestionMarkIcon,
  SearchIcon,
  Settings2Icon,
  StarIcon,
} from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { AgentMark } from './agent-mark';
import { ChipSelectItem, ChipSelectList, ChipSelectPopup } from './chip-select';
import { ComposerToolButton } from './composer';
import { EffortSlider, type EffortStop } from './effort-slider';
import { Input } from './input';
import { Popover, PopoverTrigger } from './popover';

/** `legacy`: an earlier generation, kept behind the agent's "More models" row. */
type AgentModel = { value: string; label: string; legacy?: boolean };

type AgentOption = {
  id: string;
  label: string;
  models: AgentModel[];
};

type Engine = { agent: string; model: string | null };

/** How hard the current model thinks, drawn under the models and named on the button. */
type AgentModelEffort<V extends string = string> = {
  stops: readonly EffortStop<V>[];
  value: V;
  onValueChange: (value: V) => void;
};

type AgentModelSelectLabels = {
  favourites: string;
  favouritesEmpty: string;
  addFavourite: (model: string) => string;
  removeFavourite: (model: string) => string;
  effort: string;
  faster: string;
  smarter: string;
  effortHint: string;
  moreModels: string;
  configure: string;
};

const DEFAULT_LABELS: AgentModelSelectLabels = {
  favourites: 'Favourites',
  favouritesEmpty: 'Star a model to keep it here.',
  addFavourite: (model) => `Add ${model} to favourites`,
  removeFavourite: (model) => `Remove ${model} from favourites`,
  effort: 'Effort',
  faster: 'Faster',
  smarter: 'Smarter',
  effortHint:
    'How long the agent may think before it answers. Higher effort costs more and takes longer.',
  moreModels: 'More models',
  configure: 'Choose agents',
};

/** Rows visible before the list scrolls. */
const VISIBLE_ROWS = 7;

/** The Favourites tab's id; no agent is called this. */
const FAVOURITES = '★';

const defaultEmptyText = (query: string): React.ReactNode => `No model matches “${query}”.`;

/** The key a favourite is kept by: the agent and the model, which only make sense together. */
function engineKey(engine: Engine): string {
  return `${engine.agent}:${engine.model ?? ''}`;
}

type Row = { agent: AgentOption; model: AgentModel | null };

/** An agent's rows: its models, or the agent itself when it has none (a blank terminal). */
function rowsOf(agent: AgentOption): Row[] {
  return agent.models.length > 0
    ? agent.models.map((model) => ({ agent, model }))
    : [{ agent, model: null }];
}

function rowKey(row: Row): string {
  return engineKey({ agent: row.agent.id, model: row.model?.value ?? null });
}

/**
 * The popup's three modes, as rows: a search spans every agent, the
 * Favourites tab the starred rows, an agent's tab that agent's. `total` sizes
 * the list from the whole set the mode draws from, so a search does not
 * resize it under the cursor; `mixed` says the rows are from several agents
 * and each should wear its mark.
 *
 * An agent's tab lists its current models, then — when it has any — the
 * "More models" row, `more`, and its legacy models under that once
 * `expanded`. A search and Favourites reach legacy models like any other.
 */
function rowsFor(
  agents: readonly AgentOption[],
  {
    term,
    tab,
    favourites,
    expanded,
  }: { term: string; tab: string; favourites: readonly string[]; expanded: boolean },
): { rows: Row[]; total: number; mixed: boolean; more: Row[] | null } {
  const all = agents.flatMap(rowsOf);
  if (term) {
    const rows = all.filter(({ agent, model }) =>
      `${model?.label ?? ''} ${agent.label}`.toLowerCase().includes(term),
    );
    return { rows, total: all.length, mixed: true, more: null };
  }
  if (tab === FAVOURITES) {
    const rows = all.filter((row) => favourites.includes(rowKey(row)));
    return { rows, total: rows.length, mixed: true, more: null };
  }
  const agent = agents.find((candidate) => candidate.id === tab);
  const own = agent ? rowsOf(agent) : [];
  const rows = own.filter((row) => !row.model?.legacy);
  const legacy = own.filter((row) => row.model?.legacy);
  if (legacy.length === 0) return { rows, total: rows.length, mixed: false, more: null };
  const more = expanded ? legacy : [];
  return { rows, total: rows.length + 1 + more.length, mixed: false, more };
}

/** The tab strip: Favourites when the caller keeps them, then one tab per agent's mark. */
function AgentModelTabs({
  tabs,
  selected,
  onSelect,
  configure,
  'aria-label': ariaLabel,
}: {
  tabs: { id: string; label: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** Present: a settings glyph ends the strip, outside the tabs, and calls `onClick`. */
  configure?: { label: string; onClick: () => void };
  'aria-label': string;
}) {
  return (
    <div className="flex items-start border-b border-border-subtle px-1 pt-1">
    <div role="tablist" aria-label={ariaLabel} className="flex min-w-0 flex-1 gap-0.5">
      {tabs.map((item) => {
        const on = selected === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={item.label}
            title={item.label}
            onClick={() => onSelect(item.id)}
            className="group/tab flex flex-1 flex-col items-center gap-1 pt-0.5 outline-none"
          >
            <span
              className={cn(
                'flex h-6 w-7 items-center justify-center rounded-sm text-fg-muted transition-[background-color,opacity] duration-fast group-hover/tab:bg-hover-surface group-focus-visible/tab:outline-2 group-focus-visible/tab:outline-ring',
                on ? 'opacity-100' : 'opacity-55',
              )}
            >
              {item.id === FAVOURITES ? (
                <StarIcon className="size-3.5" fill="currentColor" strokeWidth={0} aria-hidden />
              ) : (
                <AgentMark agent={item.id} className="[&_svg]:size-3.5" />
              )}
            </span>
            <span className={cn('h-0.5 w-4 rounded-pill', on ? 'bg-fg' : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
    {configure ? (
      <button
        type="button"
        aria-label={configure.label}
        title={configure.label}
        onClick={configure.onClick}
        className="group/tab flex shrink-0 flex-col items-center gap-1 pt-0.5 pl-0.5 outline-none"
      >
        <span className="flex h-6 w-7 items-center justify-center rounded-sm text-fg-muted opacity-55 transition-[background-color,opacity] duration-fast group-hover/tab:bg-hover-surface group-hover/tab:opacity-100 group-focus-visible/tab:outline-2 group-focus-visible/tab:outline-ring">
          <Settings2Icon className="size-3.5" aria-hidden />
        </span>
        <span className="h-0.5 w-4" />
      </button>
    ) : null}
    </div>
  );
}

/** A row's star: whether it is in Favourites, and the toggle. */
function AgentModelStar({
  starred,
  name,
  labels,
  onToggle,
}: {
  starred: boolean;
  name: string;
  labels: Pick<AgentModelSelectLabels, 'addFavourite' | 'removeFavourite'>;
  onToggle: () => void;
}) {
  const label = starred ? labels.removeFavourite(name) : labels.addFavourite(name);
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={cn(
        'flex shrink-0 rounded-pill p-1.25 outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring',
        starred ? 'text-warning' : 'text-fg-subtle',
      )}
    >
      <StarIcon
        className="size-3.75"
        fill={starred ? 'currentColor' : 'none'}
        strokeWidth={1.8}
        aria-hidden
      />
    </button>
  );
}

/** The popup's foot: "Effort · Medium", the hint glyph, Faster and Smarter, and the slider. */
function AgentModelEffortFoot<V extends string>({
  effort,
  labels,
}: {
  effort: AgentModelEffort<V>;
  labels: Pick<AgentModelSelectLabels, 'effort' | 'faster' | 'smarter' | 'effortHint'>;
}) {
  const hintId = React.useId();
  const current = effort.stops.find((stop) => stop.value === effort.value) ?? effort.stops[0];
  return (
    <div
      data-slot="agent-model-effort"
      className="flex flex-col gap-2 border-t border-border-subtle px-3 py-2.5"
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="text-fg-muted">{labels.effort}</span>
        <span key={effort.value} className="motion-safe:animate-effort-in text-fg">
          {current?.label}
        </span>
        <span className="flex-1" />
        {/* The glyph is the pointer's way to the hint; the slider carries it as its description. */}
        <span className="flex text-fg-subtle" title={labels.effortHint}>
          <CircleQuestionMarkIcon className="size-3.5" aria-hidden />
        </span>
        <span id={hintId} className="sr-only">
          {labels.effortHint}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[11px] text-fg-muted">
          <span>{labels.faster}</span>
          <span>{labels.smarter}</span>
        </div>
        <EffortSlider
          stops={effort.stops}
          value={effort.value}
          onValueChange={effort.onValueChange}
          aria-label={labels.effort}
          aria-describedby={hintId}
        />
      </div>
    </div>
  );
}

/**
 * AgentModelSelect — the engine button in the composer's foot row: the
 * agent's mark, the model's name and, muted after it, the effort. One button
 * for all three, so the row stays one line.
 *
 * It opens on a strip of tabs, one per agent's mark, the current agent's
 * open; its models list below a search row, the current one checked. Typing
 * searches every agent's models at once, and a row from another agent wears
 * that agent's mark. Picking a model picks its agent with it, so the pair is
 * always valid.
 *
 * An agent's earlier generations, its `legacy` models, wait behind a "More
 * models" row at the foot of its tab, open from the start when one of them is
 * the current model; a search finds them like any other.
 *
 * Three parts are the caller's to switch on. With `onFavouritesChange`, a
 * Favourites tab leads the strip and each row ends in a star; the caller keeps
 * the list, as `engineKey`s. With `onConfigure`, a settings glyph ends the
 * strip, outside the tabs, for where the caller chooses which agents the
 * strip holds; the popup closes as it is pressed. With `effort`, the popup ends in the effort
 * slider for the current model and the button names the level, in a cell as
 * wide as the longest level so the button never changes width under the
 * popup anchored to it.
 *
 * ```tsx
 * <AgentModelSelect
 *   agents={[{ id: 'claude-code', label: 'Claude Code', models: [{ value: 'claude-opus-5-5', label: 'Opus 5.5' }] }]}
 *   value={{ agent: 'claude-code', model: 'claude-opus-5-5' }}
 *   onValueChange={setEngine}
 *   favourites={favourites}
 *   onFavouritesChange={setFavourites}
 *   effort={{ stops, value: effort, onValueChange: setEffort }}
 * />
 * ```
 */
function AgentModelSelect<V extends string = string>({
  agents,
  value,
  onValueChange,
  favourites = [],
  onFavouritesChange,
  effort,
  onConfigure,
  labels: labelsProp,
  searchPlaceholder = 'Search models…',
  emptyText: emptyTextProp,
  disabled,
  className,
  'aria-label': ariaLabel = 'Agent and model',
}: {
  agents: AgentOption[];
  value: Engine;
  onValueChange: (value: Engine) => void;
  /** Starred rows, as `engineKey`s, in the order they were starred. */
  favourites?: readonly string[];
  /** Present: the Favourites tab and the stars show. */
  onFavouritesChange?: (favourites: string[]) => void;
  effort?: AgentModelEffort<V>;
  /** Present: the strip ends in a settings glyph that calls it. */
  onConfigure?: () => void;
  labels?: Partial<AgentModelSelectLabels>;
  searchPlaceholder?: string;
  emptyText?: (query: string) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  // Not a default parameter: the React Compiler skips a function-valued one.
  const emptyText = emptyTextProp ?? defaultEmptyText;
  const label = { ...DEFAULT_LABELS, ...labelsProp };
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  // Null until the reader toggles it: open when the current model is a legacy one.
  const [moreOpen, setMoreOpen] = React.useState<boolean | null>(null);

  const current = agents.find((agent) => agent.id === value.agent);
  const currentModel = current?.models.find((model) => model.value === value.model);
  const term = query.trim().toLowerCase();
  const shownTab = tab ?? value.agent;
  const shownAgent = agents.find((agent) => agent.id === shownTab);
  const expanded =
    moreOpen ??
    (shownTab === value.agent &&
      Boolean(shownAgent?.models.some((model) => model.legacy && model.value === value.model)));
  const { rows, total, mixed, more } = rowsFor(agents, {
    term,
    tab: shownTab,
    favourites,
    expanded,
  });
  const tabs = [
    ...(onFavouritesChange ? [{ id: FAVOURITES, label: label.favourites }] : []),
    ...agents.map((agent) => ({ id: agent.id, label: agent.label })),
  ];

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTab(null);
      setQuery('');
      setMoreOpen(null);
    }
  }

  function renderRow(row: Row) {
    const key = rowKey(row);
    // A mark is aria-hidden: where agents mix, the name says whose row it is,
    // since two agents can offer the same model.
    const name = mixed && row.model
      ? `${row.model.label} · ${row.agent.label}`
      : (row.model?.label ?? row.agent.label);
    return (
      <div key={key} className="flex items-center">
        <ChipSelectItem
          density="engine"
          selected={value.agent === row.agent.id && value.model === (row.model?.value ?? null)}
          leading={mixed ? <AgentMark agent={row.agent.id} /> : undefined}
          className="min-w-0 flex-1"
          aria-label={name}
          onClick={() => {
            onValueChange({ agent: row.agent.id, model: row.model?.value ?? null });
            onOpenChange(false);
          }}
        >
          {row.model?.label ?? row.agent.label}
        </ChipSelectItem>
        {onFavouritesChange ? (
          <AgentModelStar
            starred={favourites.includes(key)}
            name={name}
            labels={label}
            onToggle={() =>
              onFavouritesChange(
                favourites.includes(key)
                  ? favourites.filter((kept) => kept !== key)
                  : [...favourites, key],
              )
            }
          />
        ) : null}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <ComposerToolButton
            icon={<AgentMark agent={value.agent} />}
            open={open}
            disabled={disabled}
            aria-label={ariaLabel}
            className={className}
          >
            {currentModel?.label ?? current?.label ?? value.agent}
            {effort ? (
              // Every stop in one cell: as wide as the longest, only the current one paints.
              <span className="ml-[7px] inline-grid text-fg-muted">
                {effort.stops.map((stop) => (
                  <span
                    key={stop.value}
                    aria-hidden={stop.value !== effort.value}
                    className={cn(
                      'col-start-1 row-start-1',
                      stop.value !== effort.value && 'invisible',
                    )}
                  >
                    {stop.label}
                  </span>
                ))}
              </span>
            ) : null}
          </ComposerToolButton>
        }
      />
      <ChipSelectPopup density="engine" side="top" align="end" className="p-0">
        <AgentModelTabs
          tabs={tabs}
          selected={term ? null : shownTab}
          onSelect={(id) => {
            setTab(id);
            setQuery('');
            setMoreOpen(null);
          }}
          configure={
            onConfigure
              ? {
                  label: label.configure,
                  onClick: () => {
                    onOpenChange(false);
                    onConfigure();
                  },
                }
              : undefined
          }
          aria-label={ariaLabel}
        />
        <div className="px-1.5 pt-1.5">
          <Input
            size="sm"
            // biome-ignore lint/a11y/noAutofocus: the search is the reason the popup opened
            autoFocus
            leading={<SearchIcon className="size-3" />}
            // Focus is where the popup opens; the halo would light up every opening.
            className="has-focus-visible:ring-0"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <ChipSelectList
          density="engine"
          role="listbox"
          aria-label={ariaLabel}
          rows={VISIBLE_ROWS}
          total={total}
          empty={rows.length === 0}
          emptyText={term ? emptyText(query) : label.favouritesEmpty}
          // 6px under the last row, so it never sits on the effort foot's hairline.
          className="px-1 pt-1 pb-1.5"
        >
          {rows.map(renderRow)}
          {more ? (
            <ChipSelectItem
              density="engine"
              role="button"
              aria-expanded={expanded}
              className="text-fg-muted"
              trailing={
                expanded ? (
                  <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden />
                )
              }
              onClick={() => setMoreOpen(!expanded)}
            >
              {label.moreModels}
            </ChipSelectItem>
          ) : null}
          {more?.map(renderRow)}
        </ChipSelectList>
        {effort ? <AgentModelEffortFoot effort={effort} labels={label} /> : null}
      </ChipSelectPopup>
    </Popover>
  );
}

export { AgentModelSelect, engineKey };
export type { AgentModel, AgentModelEffort, AgentModelSelectLabels, AgentOption, Engine };
