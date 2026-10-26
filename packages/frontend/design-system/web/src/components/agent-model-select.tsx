'use client';

import { CircleQuestionMarkIcon, StarIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { AgentMark } from './agent-mark';
import { ChipSelectItem, ChipSelectList, ChipSelectPopup, ChipSelectSearch } from './chip-select';
import { ComposerToolButton } from './composer';
import { EffortSlider, type EffortStop } from './effort-slider';
import { Popover, PopoverTrigger } from './popover';

type AgentModel = { value: string; label: string };

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
};

/** Rows visible before the list scrolls. */
const VISIBLE_ROWS = 7;

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

/**
 * AgentModelSelect — the engine button in the composer's foot row: the
 * agent's mark, the model's name and, muted after it, the effort. One button
 * for all three, so the row stays one line.
 *
 * It opens on a strip of tabs: Favourites (a star), then one per agent, its
 * mark. The current agent's tab is open first; its models list below a search
 * row, the current one checked. Typing searches every agent's models at once,
 * and a row from another agent wears that agent's mark. Each row ends in a
 * star that keeps it in Favourites, which is the one tab mixing agents.
 * Picking a model picks its agent with it, so the pair is always valid.
 *
 * With `effort`, the popup ends in the effort slider for the current model,
 * and the button names the level. With `onFavouritesChange`, the Favourites
 * tab and the stars show; the caller keeps the list (as `engineKey`s).
 *
 * ```tsx
 * <AgentModelSelect
 *   agents={[{ id: 'claude-code', label: 'Claude Code', models: [{ value: 'claude-opus-5-5', label: 'Claude Opus 5.5' }] }]}
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
  // The level a drag started from, shown by the button until it ends: the
  // popup is anchored to the button, so a live label would move both.
  const [held, setHeld] = React.useState<V | null>(null);
  const hintId = React.useId();

  const starrable = onFavouritesChange !== undefined;
  const current = agents.find((agent) => agent.id === value.agent);
  const currentModel = current?.models.find((model) => model.value === value.model);
  const shownTab = tab ?? value.agent;
  const term = query.trim().toLowerCase();

  const allRows = agents.flatMap(rowsOf);
  let rows: Row[];
  let total: number;
  if (term) {
    rows = allRows.filter(({ agent, model }) =>
      `${model?.label ?? ''} ${agent.label}`.toLowerCase().includes(term),
    );
    total = allRows.length;
  } else if (shownTab === FAVOURITES) {
    rows = allRows.filter((row) =>
      favourites.includes(engineKey({ agent: row.agent.id, model: row.model?.value ?? null })),
    );
    total = rows.length;
  } else {
    const agent = agents.find((candidate) => candidate.id === shownTab);
    rows = agent ? rowsOf(agent) : [];
    total = rows.length;
  }
  // A list that mixes agents says whose each row is.
  const mixed = Boolean(term) || shownTab === FAVOURITES;

  const effortShown = effort
    ? (effort.stops.find((stop) => stop.value === (held ?? effort.value)) ?? effort.stops[0])
    : undefined;
  const effortCurrent = effort
    ? (effort.stops.find((stop) => stop.value === effort.value) ?? effort.stops[0])
    : undefined;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTab(null);
      setQuery('');
      setHeld(null);
    }
  }

  function toggleFavourite(key: string) {
    onFavouritesChange?.(
      favourites.includes(key) ? favourites.filter((kept) => kept !== key) : [...favourites, key],
    );
  }

  const tabs = [
    ...(starrable ? [{ id: FAVOURITES, label: label.favourites }] : []),
    ...agents.map((agent) => ({ id: agent.id, label: agent.label })),
  ];

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
            {effort && effortShown ? (
              // Every stop in one cell: the cell is as wide as the longest, so a
              // new level never moves the button.
              <span className="ml-[7px] inline-grid text-fg-muted">
                {effort.stops.map((stop) => (
                  <span
                    key={stop.value}
                    aria-hidden={stop.value !== effortShown.value}
                    className={cn(
                      'col-start-1 row-start-1',
                      stop.value !== effortShown.value && 'invisible',
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
      <ChipSelectPopup density="menu" side="top" align="end" width={340} className="p-0">
        <div
          role="tablist"
          aria-label={ariaLabel}
          className="flex gap-0.5 px-1.5 pt-1.5"
        >
          {tabs.map((item) => {
            const selected = !term && shownTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={item.label}
                title={item.label}
                onClick={() => {
                  setTab(item.id);
                  setQuery('');
                }}
                className="group/tab flex flex-1 flex-col items-center gap-1.5 pt-1.5 outline-none"
              >
                <span
                  className={cn(
                    'flex h-7 w-8 items-center justify-center rounded-sm text-fg-muted transition-[background-color,opacity] duration-fast group-hover/tab:bg-hover-surface group-focus-visible/tab:outline-2 group-focus-visible/tab:outline-ring',
                    selected ? 'opacity-100' : 'opacity-55',
                  )}
                >
                  {item.id === FAVOURITES ? (
                    <StarIcon className="size-4.5" fill="currentColor" strokeWidth={0} aria-hidden />
                  ) : (
                    <AgentMark agent={item.id} className="[&_svg]:size-4.5" />
                  )}
                </span>
                <span
                  className={cn('h-0.5 w-5 rounded-pill', selected ? 'bg-fg' : 'bg-transparent')}
                />
              </button>
            );
          })}
        </div>
        <div className="px-1">
          <ChipSelectSearch
            density="menu"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            className="text-[13px]"
          />
        </div>
        <ChipSelectList
          density="menu"
          role="listbox"
          aria-label={ariaLabel}
          rows={VISIBLE_ROWS}
          total={total}
          empty={rows.length === 0}
          emptyText={term ? emptyText(query) : label.favouritesEmpty}
          className="px-1 pb-1"
        >
          {rows.map(({ agent, model }) => {
            const key = engineKey({ agent: agent.id, model: model?.value ?? null });
            const starred = favourites.includes(key);
            const name = model?.label ?? agent.label;
            return (
              <div key={key} className="flex items-center">
                <ChipSelectItem
                  density="menu"
                  selected={value.agent === agent.id && value.model === (model?.value ?? null)}
                  leading={mixed ? <AgentMark agent={agent.id} /> : undefined}
                  className="min-w-0 flex-1"
                  onClick={() => {
                    onValueChange({ agent: agent.id, model: model?.value ?? null });
                    onOpenChange(false);
                  }}
                >
                  {name}
                </ChipSelectItem>
                {starrable ? (
                  <button
                    type="button"
                    aria-pressed={starred}
                    aria-label={starred ? label.removeFavourite(name) : label.addFavourite(name)}
                    title={starred ? label.removeFavourite(name) : label.addFavourite(name)}
                    onClick={() => toggleFavourite(key)}
                    className={cn(
                      'flex shrink-0 rounded-pill p-1.5 outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring',
                      starred ? 'text-warning' : 'text-fg-subtle',
                    )}
                  >
                    <StarIcon
                      className="size-3.5"
                      fill={starred ? 'currentColor' : 'none'}
                      strokeWidth={1.8}
                      aria-hidden
                    />
                  </button>
                ) : null}
              </div>
            );
          })}
        </ChipSelectList>
        {effort && effortCurrent ? (
          <div
            data-slot="agent-model-effort"
            className="flex flex-col gap-[11px] border-t border-border-subtle px-3.5 py-[13px]"
          >
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-fg-muted">{label.effort}</span>
              <span key={effort.value} className="motion-safe:animate-effort-in text-fg">
                {effortCurrent.label}
              </span>
              <span className="flex-1" />
              {/* The glyph is the pointer's way to the hint; the slider carries it as its description. */}
              <span className="flex text-fg-subtle" title={label.effortHint}>
                <CircleQuestionMarkIcon className="size-[15px]" aria-hidden />
              </span>
              <span id={hintId} className="sr-only">
                {label.effortHint}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-fg-muted">
                <span>{label.faster}</span>
                <span>{label.smarter}</span>
              </div>
              <EffortSlider
                stops={effort.stops}
                value={effort.value}
                onValueChange={effort.onValueChange}
                onDraggingChange={(dragging) => setHeld(dragging ? effort.value : null)}
                aria-label={label.effort}
                aria-describedby={hintId}
              />
            </div>
          </div>
        ) : null}
      </ChipSelectPopup>
    </Popover>
  );
}

export { AgentModelSelect, engineKey };
export type { AgentModel, AgentModelEffort, AgentModelSelectLabels, AgentOption, Engine };
