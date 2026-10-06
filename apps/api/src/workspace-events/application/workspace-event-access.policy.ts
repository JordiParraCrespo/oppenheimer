import { type AppAbility, expandScopes, type Scope } from '@oppenheimer/shared';
import {
  WORKSPACE_EVENT_TYPES,
  type WorkspaceEventType,
} from '@oppenheimer/shared/workspace-events';
import type { ScopeContext } from '../../auth/domain/scope-context.types';

/** What reading each kind of change takes: the subject a role reads it by, the scope a credential does. */
const READ_BY: Record<
  WorkspaceEventType,
  { subject: 'Session' | 'Host' | 'Automation'; scope: Scope }
> = {
  'session.changed': { subject: 'Session', scope: 'sessions:read' },
  'host.changed': { subject: 'Host', scope: 'hosts:read' },
  'pairing.spent': { subject: 'Host', scope: 'hosts:read' },
  'automationRun.changed': { subject: 'Automation', scope: 'automations:read' },
};

/** The kinds of change this caller may read: its role's ability, and a credential's scopes on top. */
export function readableTypes(
  ability: AppAbility,
  credential: ScopeContext | null,
): Set<WorkspaceEventType> {
  const scopes = credential ? expandScopes(credential.scopes) : null;
  return new Set(
    WORKSPACE_EVENT_TYPES.filter((type) => {
      const { subject, scope } = READ_BY[type];
      return ability.can('read', subject) && (!scopes || scopes.has(scope));
    }),
  );
}
