import { Callout } from '@oppenheimer/design-system-web';
import { useStoredList } from '@oppenheimer/frontend-web';
import {
  CODING_AGENTS,
  type CodingAgentId,
  DEFAULT_SESSION_PERMISSION,
  isCodingAgentId,
  type SessionEffort,
  type SessionPermission,
} from '@oppenheimer/shared/agents';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentSelect } from '../components/agent-select';
import { PermissionSelect } from '../components/permission-select';
import { SideAgentComposer } from '../components/side-agent-composer';
import { useModelFavourites } from '../hooks/use-model-favourites';
import { AGENT_CHOICES_KEY, shownAgents } from '../lib/agent-choices';
import {
  defaultModelFor,
  effortChoiceFor,
  launchControlsFor,
  toEngineAgents,
} from '../lib/session-options';
import { agentsBeside, type SideEngine } from '../lib/side-pane';

/**
 * The launcher's Agent pane: New session's composer without the host,
 * project and branch, since the agent starts in the session's worktree. The
 * box takes the agent's first task; under it, the permission level and the
 * engine button (the agent, its model and effort). Send starts it, with the
 * task or with none. It opens on the session's own engine when that agent
 * may run twice, so send alone starts a second copy of it; otherwise on the
 * first agent offered, at its defaults.
 *
 * The agents are those this device offers (Settings → Agents, as New
 * session reads them) that may start beside this session (`agentsBeside`).
 * The note above says what starting one means: it works in this session's
 * worktree, on the same files and git index as the agent already there.
 */
export function SideAgentPicker({
  session,
  onStart,
  opening,
}: {
  /** The session's own engine, which the pick opens on. */
  session: {
    agent: string;
    model: string | null;
    effort: SessionEffort | null;
    permission: SessionPermission | null;
  };
  onStart: (engine: SideEngine) => void;
  /** The agent being started, while its window opens. */
  opening: CodingAgentId | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [choices] = useStoredList(AGENT_CHOICES_KEY);
  const [favourites, setFavourites] = useModelFavourites();
  const allowed = agentsBeside(session.agent, shownAgents(choices));
  const own = allowed.find((agent) => agent === session.agent);
  const [agent, setAgent] = useState(own ?? allowed[0]);
  const [model, setModel] = useState(() =>
    own ? (session.model ?? defaultModelFor(own)) : agent ? defaultModelFor(agent) : null,
  );
  const [efforts, setEfforts] = useState<Partial<Record<CodingAgentId, string>>>(() =>
    own && session.effort ? { [own]: session.effort } : {},
  );
  const [permission, setPermission] = useState<SessionPermission>(
    session.permission ?? DEFAULT_SESSION_PERMISSION,
  );

  if (!agent) return <Callout tone="info">{t('sessions.side.launcher.noAgents')}</Callout>;
  const effort = effortChoiceFor(agent, model, efforts[agent]);
  const takesPermission = launchControlsFor(agent).permission;
  const label = CODING_AGENTS[agent].label;

  return (
    <>
      <Callout tone="info">{t('sessions.side.launcher.agentShares')}</Callout>
      <SideAgentComposer
        sendLabel={t('sessions.side.agent.start', { agent: label })}
        starting={opening !== null}
        onSubmit={(task) =>
          onStart({
            agent,
            model,
            // An effort nobody picked is left to the CLI, as on New session.
            effort: effort?.chosen ? effort.value : null,
            permission: takesPermission ? permission : null,
            prompt: task === '' ? null : task,
          })
        }
        tools={
          takesPermission ? (
            <PermissionSelect value={permission} onValueChange={setPermission} />
          ) : null
        }
        engine={
          <AgentSelect
            agents={toEngineAgents(false, null).filter((option) =>
              allowed.some((one) => one === option.id),
            )}
            value={{ agent, model }}
            onValueChange={(engine) => {
              const next = allowed.find((one) => one === engine.agent);
              if (!next || !isCodingAgentId(engine.agent)) return;
              setAgent(next);
              setModel(engine.model ?? defaultModelFor(next));
            }}
            favourites={favourites}
            onFavouritesChange={setFavourites}
            effort={effort}
            onEffortChange={(level) => setEfforts({ ...efforts, [agent]: level })}
            onConfigure={() => navigate({ to: '/settings/agents' })}
            disabled={opening !== null}
          />
        }
      />
    </>
  );
}
