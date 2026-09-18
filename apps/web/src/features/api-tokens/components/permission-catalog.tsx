import { EmptyState } from '@oppenheimer/design-system-web';
import type { PermissionGroup, Scope } from '@oppenheimer/shared';
import { useState } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PermissionPicker } from '@/features/api-tokens/components/permission-picker';
import { PermissionSearch } from '@/features/api-tokens/components/permission-search';

/**
 * The searchable permission catalog: the field, and the rows a settled query
 * leaves.
 *
 * The query lives here rather than in the form because this is the lowest
 * component that reads it — the form holds the name, the submit rule and the
 * scopes, and none of them care what the reader is looking for. While the form
 * owned it, a settled query re-rendered the name field and the submit rule
 * along with the rows.
 *
 * Three clocks, and each is one component's own: the half-typed word is
 * `PermissionSearch`'s, so a keystroke redraws one input; the settled query is
 * this component's and redraws the rows it keeps, once per burst, which it must
 * — that is what filtering is; a granted level is the row's own field off the
 * form and reaches neither of the other two.
 */
export function PermissionCatalog<TFieldValues extends FieldValues>({
  groups,
  grantable,
  control,
  name,
  disabled,
}: {
  groups: readonly PermissionGroup[];
  /** Scopes the signed-in user may grant. Anything else is shown disabled. */
  grantable: readonly Scope[];
  control: Control<TFieldValues>;
  /** The field holding the `ScopeSelection`, e.g. `permissions`. */
  name: FieldPath<TFieldValues>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const needle = query.trim().toLocaleLowerCase();
  const visible = groups.filter((group) =>
    [group.label, group.description, group.levels.read.description, group.levels.write.description]
      .join(' ')
      .toLocaleLowerCase()
      .includes(needle),
  );

  return (
    <>
      <PermissionSearch onChange={setQuery} disabled={disabled} />
      {visible.length > 0 ? (
        // No scroll cap of its own: the dialog body already scrolls, and a
        // picker that scrolled inside it gave the card two scrollbars and a
        // wheel that stopped at the picker's edge.
        <PermissionPicker
          groups={visible}
          grantable={grantable}
          control={control}
          name={name}
          disabled={disabled}
        />
      ) : (
        <EmptyState className="border border-border-subtle py-6">
          <EmptyState.Header>
            <EmptyState.Title>{t('settings.api.noPermissionResults')}</EmptyState.Title>
          </EmptyState.Header>
        </EmptyState>
      )}
    </>
  );
}
