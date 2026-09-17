import { Badge, cn, ToggleGroup, ToggleGroupItem } from '@oppenheimer/design-system-web';
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
import type { PermissionGroup, Scope, ScopeAccessLevel } from '@oppenheimer/shared';
import { useTranslation } from 'react-i18next';

/** What a group is set to. `none` means the group is not granted at all. */
type Selection = ScopeAccessLevel | 'none';

const PERMISSION_ICONS: Record<PermissionGroup['resource'], typeof UserRound> = {
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

export interface PermissionPickerProps {
  groups: readonly PermissionGroup[];
  /** Scopes the signed-in user may grant. Anything else is shown disabled. */
  grantable: readonly Scope[];
  value: readonly Scope[];
  onChange: (scopes: Scope[]) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Per-resource permission picker: each group is granted None, Read or Edit.
 *
 * Edit implies Read, so the three options are mutually exclusive rather than a
 * pair of checkboxes — that keeps "what did I just grant" unambiguous. Levels
 * the user cannot grant themselves are disabled, mirroring the rule the API
 * enforces: a token never exceeds its creator.
 */
export function PermissionPicker({
  groups,
  grantable,
  value,
  onChange,
  disabled,
  className,
}: PermissionPickerProps) {
  const { t } = useTranslation();
  const granted = new Set(value);
  const allowed = new Set(grantable);

  function selectionFor(group: PermissionGroup): Selection {
    if (granted.has(group.levels.write.scope)) return 'write';
    if (granted.has(group.levels.read.scope)) return 'read';
    return 'none';
  }

  function handleChange(group: PermissionGroup, selection: Selection) {
    const next = value.filter(
      (scope) => scope !== group.levels.read.scope && scope !== group.levels.write.scope,
    );
    if (selection !== 'none') next.push(group.levels[selection].scope);
    onChange(next);
  }

  return (
    <div
      className={cn(
        'divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle',
        className,
      )}
    >
      {groups.map((group) => {
        const selection = selectionFor(group);
        const canRead = allowed.has(group.levels.read.scope);
        const canWrite = allowed.has(group.levels.write.scope);
        const Icon = PERMISSION_ICONS[group.resource];

        return (
          <div key={group.resource} className="flex flex-wrap items-center gap-3 px-3 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-ink-600">
              <Icon className="size-4" />
            </span>
            <div className="min-w-40 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{group.label}</span>
                {group.sensitive && <Badge variant="paused">{t('apiTokens.sensitive')}</Badge>}
              </div>
              <p className="text-sm text-ink-600">{group.description}</p>
              {selection !== 'none' && (
                <p className="mt-1 text-xs text-ink-600">{group.levels[selection].description}</p>
              )}
            </div>

            <ToggleGroup
              multiple={false}
              value={[selection]}
              onValueChange={(next) => next[0] && handleChange(group, next[0] as Selection)}
              disabled={disabled}
              variant="outline"
              size="sm"
            >
              <PermissionOption
                group={group.resource}
                value="none"
                label={t('apiTokens.levels.none')}
              />
              <PermissionOption
                group={group.resource}
                value="read"
                label={group.levels.read.label}
                disabled={!canRead}
              />
              <PermissionOption
                group={group.resource}
                value="write"
                label={group.levels.write.label}
                disabled={!canWrite}
              />
            </ToggleGroup>
          </div>
        );
      })}
    </div>
  );
}

function PermissionOption({
  group,
  value,
  label,
  disabled,
}: {
  group: string;
  value: Selection;
  label: string;
  disabled?: boolean;
}) {
  const id = `${group}-${value}`;

  return (
    <ToggleGroupItem id={id} value={value} disabled={disabled}>
      {label}
    </ToggleGroupItem>
  );
}
