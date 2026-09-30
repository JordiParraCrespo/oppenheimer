import type { AutomationTaskDto } from '@oppenheimer/shared/schemas/automation';
import { type Control, useWatch } from 'react-hook-form';

/**
 * Which of the Task step's two fields is still empty, read at the leaf that
 * shows it (the step tabs, the footer) so typing re-renders those and not the
 * editor around them.
 */
export function useTaskGap(control: Control<AutomationTaskDto>): 'name' | 'prompt' | null {
  const [name, prompt] = useWatch({ control, name: ['name', 'prompt'] });
  if (!name?.trim()) return 'name';
  if (!prompt?.trim()) return 'prompt';
  return null;
}
