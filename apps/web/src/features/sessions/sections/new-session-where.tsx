import { useController } from 'react-hook-form';
import { WhereSelect } from '../components/where-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';

/** The Where chip, bound to the draft: a new worktree, or a folder already on the host. */
export function NewSessionWhere() {
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'where' });

  return <WhereSelect value={field.value} onValueChange={field.onChange} variant="tab" />;
}
