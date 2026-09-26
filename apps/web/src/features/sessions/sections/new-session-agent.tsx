import { useWatch } from 'react-hook-form';
import { AgentSelect } from '../components/agent-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { defaultModelFor, toAgentOptions } from '../lib/session-options';

/**
 * The engine button, bound to the draft. Switching agent carries the model
 * with it: a model belongs to one agent, so an agent picked without one takes
 * that agent's default.
 */
export function NewSessionAgent() {
  const { control, setValue } = useNewSessionDraft();
  const [agent, model] = useWatch({ control, name: ['agent', 'model'] });

  return (
    <AgentSelect
      agents={toAgentOptions()}
      value={{ agent, model }}
      onValueChange={(engine) => {
        const next = engine.agent as typeof agent;
        setValue('agent', next);
        setValue('model', engine.model ?? defaultModelFor(next));
      }}
    />
  );
}
