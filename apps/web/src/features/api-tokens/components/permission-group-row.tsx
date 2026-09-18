import { Badge, ToggleGroup, ToggleGroupItem } from '@oppenheimer/design-system-web';
import {
  Building2,
  CreditCard,
  KeyRound,
  Mail,
  Shield,
  UserRound,
  Users,
  Workflow,
} from '@oppenheimer/design-system-web/icons';
import type { PermissionGroup } from '@oppenheimer/shared';
import { type Control, type FieldPath, type FieldValues, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ScopeLevel, ScopeResource } from '@/features/api-tokens/lib/scope-selection';

const PERMISSION_ICONS: Record<ScopeResource, typeof UserRound> = {
  profile: UserRound,
  users: Users,
  admin: Shield,
  roles: Shield,
  organizations: Building2,
  members: Users,
  invitations: Mail,
  workspaces: Workflow,
  tokens: KeyRound,
  billing: CreditCard,
  leads: Users,
};

/**
 * One resource's row of the permission picker, subscribed to its own field.
 *
 * This is where the leaf subscription pays: `useController` here means a click
 * on "Edit" for `tokens` re-renders the tokens row. While the picker held one
 * flat `Scope[]`, the same click re-rendered all eleven rows and their
 * thirty-three toggles.
 *
 * It takes two booleans rather than the catalog of grantable scopes for the
 * same reason. A row that held the whole array rebuilt a `Set` of it on every
 * render and took a new identity whenever the catalog settled — eleven rows
 * waiting on a list ten of them do not read.
 */
export function PermissionGroupRow<TFieldValues extends FieldValues>({
  group,
  canRead,
  canWrite,
  control,
  name,
  disabled,
}: {
  group: PermissionGroup;
  /** Whether the signed-in user may grant this level; a token never exceeds its creator. */
  canRead: boolean;
  canWrite: boolean;
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  // No `defaultValue`: a row that has never been touched has granted nothing,
  // and `scopesFromSelection` reads a missing key as exactly that.
  const { field } = useController({ control, name });

  const level = (field.value ?? 'none') as ScopeLevel;
  const Icon = PERMISSION_ICONS[group.resource];

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-ink-600">
        <Icon className="size-4" />
      </span>
      <div className="min-w-40 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{group.label}</span>
          {group.sensitive && <Badge variant="paused">{t('apiTokens.sensitive')}</Badge>}
        </div>
        <p className="text-sm text-ink-600">{group.description}</p>
        {level !== 'none' && (
          <p className="mt-1 text-xs text-ink-600">{group.levels[level].description}</p>
        )}
      </div>

      <ToggleGroup
        multiple={false}
        value={[level]}
        onValueChange={(next) => next[0] && field.onChange(next[0] as ScopeLevel)}
        disabled={disabled}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem id={`${group.resource}-none`} value="none">
          {t('apiTokens.levels.none')}
        </ToggleGroupItem>
        <ToggleGroupItem id={`${group.resource}-read`} value="read" disabled={!canRead}>
          {group.levels.read.label}
        </ToggleGroupItem>
        <ToggleGroupItem id={`${group.resource}-write`} value="write" disabled={!canWrite}>
          {group.levels.write.label}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
