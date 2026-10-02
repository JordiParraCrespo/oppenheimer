import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { usePrepareDraft } from '../hooks/use-prepare-draft';

/**
 * Draws nothing: it holds the prepare mutation so its status changes re-render
 * this and not the form, which renders once (`NewSessionForm`).
 */
export function NewSessionPrepare() {
  usePrepareDraft(useNewSessionDraft());
  return null;
}
