import { useController, useWatch } from 'react-hook-form';
import { AgentSelect } from '../components/agent-select';
import { useModelFavourites } from '../hooks/use-model-favourites';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { defaultModelFor, effortChoiceFor, toAgentOptions } from '../lib/session-options';

/**
 * The engine button, bound to the draft: agent, model and effort. Switching
 * agent carries the model with it: a model belongs to one agent, so an agent
 * picked without one takes that agent's default. The effort slider is drawn
 * only for a model whose catalog row takes an effort — not the blank
 * terminal, not Claude's Haiku — over that model's levels, with a pick kept
 * per agent.
 */
export function NewSessionAgent() {
  const { control, setValue } = useNewSessionDraft();
  const [agent, model] = useWatch({ control, name: ['agent', 'model'] });
  const { field: efforts } = useController({ control, name: 'efforts' });
  const [favourites, setFavourites] = useModelFavourites();

  return (
    <AgentSelect
      agents={toAgentOptions()}
      value={{ agent, model }}
      onValueChange={(engine) => {
        const next = engine.agent as typeof agent;
        setValue('agent', next);
        setValue('model', engine.model ?? defaultModelFor(next));
      }}
      favourites={favourites}
      onFavouritesChange={setFavourites}
      effort={effortChoiceFor(agent, model, efforts.value[agent])}
      onEffortChange={(level) => efforts.onChange({ ...efforts.value, [agent]: level })}
    />
  );
}
