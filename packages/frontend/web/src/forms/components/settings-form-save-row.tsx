import { Button, SettingsSaveRow } from '@oppenheimer/design-system-web';
import { type Control, type FieldValues, useFormState } from 'react-hook-form';

/**
 * The foot of a settings card that saves together (`SettingsForm`): nothing
 * while the draft matches what is saved; Discard and Save while it differs,
 * Save showing its pending label while the save is in flight and Discard
 * waiting for it; "Saved" after a save until the next edit. It reads whether
 * the draft differs off `control` itself, so a keystroke re-renders the foot
 * and not the form around it. Discard is the caller's: it resets the form.
 */
export function SettingsFormSaveRow<T extends FieldValues>({
  control,
  pending,
  saved,
  labels,
  onDiscard,
}: {
  control: Control<T>;
  pending: boolean;
  saved: boolean;
  labels: { discard: string; save: string; saving: string; saved: string };
  onDiscard: () => void;
}) {
  const { isDirty } = useFormState({ control });

  if (isDirty) {
    return (
      <SettingsSaveRow>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onDiscard}>
          {labels.discard}
        </Button>
        <Button type="submit" size="sm" pending={pending} pendingLabel={labels.saving}>
          {labels.save}
        </Button>
      </SettingsSaveRow>
    );
  }
  return saved ? <SettingsSaveRow role="status">{labels.saved}</SettingsSaveRow> : null;
}
