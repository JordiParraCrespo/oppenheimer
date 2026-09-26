import { useController, useWatch } from 'react-hook-form';
import { PermissionSelect } from '../components/permission-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { launchControlsFor } from '../lib/session-options';

/**
 * The permission menu, bound to the draft. Drawn only for an agent whose
 * catalog entry takes a permission level; the blank terminal takes none.
 */
export function NewSessionPermission() {
  const { control } = useNewSessionDraft();
  const agent = useWatch({ control, name: 'agent' });
  const { field } = useController({ control, name: 'permission' });

  if (!launchControlsFor(agent).permission) return null;

  return <PermissionSelect value={field.value} onValueChange={field.onChange} />;
}
