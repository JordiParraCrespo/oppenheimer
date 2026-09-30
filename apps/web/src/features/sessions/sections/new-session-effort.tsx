import { useController, useWatch } from 'react-hook-form';
import { EffortSelect } from '../components/effort-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { effortChoiceFor } from '../lib/session-options';

/**
 * The effort picker, bound to the draft. Drawn only for a model whose catalog
 * row takes an effort — not the blank terminal, not Claude's Haiku — over that
 * model's levels, with a pick kept per agent.
 */
export function NewSessionEffort() {
  const { control } = useNewSessionDraft();
  const agent = useWatch({ control, name: 'agent' });
  const model = useWatch({ control, name: 'model' });
  const { field } = useController({ control, name: 'efforts' });

  const choice = effortChoiceFor(agent, model, field.value[agent]);
  if (!choice) return null;

  return (
    <EffortSelect
      levels={choice.levels}
      value={choice.value}
      onValueChange={(level) => field.onChange({ ...field.value, [agent]: level })}
    />
  );
}
