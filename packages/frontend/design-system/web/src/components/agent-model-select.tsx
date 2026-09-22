'use client';

import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { AgentMark } from './agent-mark';
import { ChipSelectBack, ChipSelectItem, ChipSelectList, ChipSelectPopup, ChipSelectSearch } from './chip-select';
import { ComposerToolButton } from './composer';
import { Popover, PopoverTrigger } from './popover';

/**
 * AgentModelSelect — the engine button in the composer's foot row: the
 * agent's mark and the model's name ("Claude Opus 5"). Opening lands on
 * the agent pane, the harness the session already uses checked and every
 * other one a step away; choosing one slides the same 252px popup to its
 * models, with a back row naming the agent, a search row and the check on
 * the current model. Harness first, then its models: the pair has to be
 * valid, and the second pane is the only place that guarantees it.
 *
 * An agent with no models (a blank terminal) is picked outright, and the
 * button then names the agent, because it is still the way back to a
 * different one.
 *
 * ```tsx
 * <AgentModelSelect
 *   agents={[{ id: 'claude-code', label: 'Claude Code', models: [{ value: 'claude-opus-5', label: 'Claude Opus 5' }] }]}
 *   value={{ agent: 'claude-code', model: 'claude-opus-5' }}
 *   onValueChange={setEngine}
 * />
 * ```
 */
type AgentModel = { value: string; label: string };

type AgentOption = {
  id: string;
  label: string;
  models: AgentModel[];
};

type Engine = { agent: string; model: string | null };

/** Rows visible before the list scrolls, as on the artboard. */
const VISIBLE_ROWS = 4;

function AgentModelSelect({
  agents,
  value,
  onValueChange,
  searchPlaceholder = 'Search models…',
  emptyText = (query) => `No model matches “${query}”.`,
  disabled,
  className,
  'aria-label': ariaLabel = 'Agent and model',
}: {
  agents: AgentOption[];
  value: Engine;
  onValueChange: (value: Engine) => void;
  searchPlaceholder?: string;
  emptyText?: (query: string) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pane, setPane] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  const current = agents.find((agent) => agent.id === value.agent);
  const currentModel = current?.models.find((model) => model.value === value.model);
  const sub = pane ? agents.find((agent) => agent.id === pane) : undefined;
  const term = query.trim().toLowerCase();
  const models = (sub?.models ?? []).filter((model) =>
    term ? model.label.toLowerCase().includes(term) : true,
  );

  function close() {
    setOpen(false);
    setPane(null);
    setQuery('');
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPane(null);
          setQuery('');
        }
      }}
    >
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
          </ComposerToolButton>
        }
      />
      <ChipSelectPopup density="menu" side="top" align="end">
        {sub ? (
          <>
            <ChipSelectBack
              density="menu"
              onClick={() => {
                setPane(null);
                setQuery('');
              }}
            >
              <span className="flex items-center gap-2">
                <AgentMark agent={sub.id} />
                {sub.label}
              </span>
            </ChipSelectBack>
            <ChipSelectSearch
              density="menu"
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
            <ChipSelectList
              density="menu"
              role="listbox"
              aria-label={sub.label}
              rows={VISIBLE_ROWS}
              total={sub.models.length}
              empty={models.length === 0}
              emptyText={emptyText(query)}
            >
              {models.map((model) => (
                <ChipSelectItem
                  key={model.value}
                  density="menu"
                  selected={value.agent === sub.id && value.model === model.value}
                  onClick={() => {
                    onValueChange({ agent: sub.id, model: model.value });
                    close();
                  }}
                >
                  {model.label}
                </ChipSelectItem>
              ))}
            </ChipSelectList>
          </>
        ) : (
          <ChipSelectList density="menu" role="menu" aria-label={ariaLabel}>
            {agents.map((agent) => (
              <ChipSelectItem
                key={agent.id}
                density="menu"
                role="menuitem"
                aria-current={agent.id === value.agent || undefined}
                leading={<AgentMark agent={agent.id} />}
                // A row that ends in a way into its models rather than in a
                // check: the check says which agent is current, the chevron
                // that there is a pane behind it.
                trailing={
                  <span className="flex shrink-0 items-center gap-2">
                    {agent.id === value.agent ? (
                      <CheckIcon className="size-3.5 text-link" strokeWidth={2.5} aria-hidden />
                    ) : null}
                    {agent.models.length > 0 ? (
                      <ChevronRightIcon className="size-3.5 text-fg-subtle" aria-hidden />
                    ) : (
                      <span className="size-3.5" />
                    )}
                  </span>
                }
                onClick={() => {
                  if (agent.models.length === 0) {
                    onValueChange({ agent: agent.id, model: null });
                    close();
                  } else {
                    setPane(agent.id);
                    setQuery('');
                  }
                }}
              >
                {agent.label}
              </ChipSelectItem>
            ))}
          </ChipSelectList>
        )}
      </ChipSelectPopup>
    </Popover>
  );
}

export { AgentModelSelect };
export type { AgentModel, AgentOption, Engine };
