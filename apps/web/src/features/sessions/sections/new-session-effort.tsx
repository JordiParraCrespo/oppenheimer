import { useController, useWatch } from 'react-hook-form';
import { EffortSelect } from '../components/effort-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { launchControlsFor } from '../lib/session-options';

/**
 * The effort picker, bound to the draft. Drawn only for an agent whose catalog
 * entry takes an effort; the blank terminal takes none.
 */
export function NewSessionEffort() {
  const { control } = useNewSessionDraft();
  const agent = useWatch({ control, name: 'agent' });
  const { field } = useController({ control, name: 'effort' });

  if (!launchControlsFor(agent).effort) return null;

  return <EffortSelect value={field.value} onValueChange={field.onChange} />;
}
