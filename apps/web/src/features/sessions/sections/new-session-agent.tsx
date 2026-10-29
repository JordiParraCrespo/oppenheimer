import { useCloudAgentModels, useCloudAgentStatus } from '@oppenheimer/frontend-consumer/react';
import { isCodingAgentId } from '@oppenheimer/shared/agents';
import { CLOUD_AGENT_PROVIDERS } from '@oppenheimer/shared/schemas/cloud-agent';
import { useController, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AgentSelect } from '../components/agent-select';
import { useModelFavourites } from '../hooks/use-model-favourites';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import {
  CLOUD_DEFAULT_MODEL,
  defaultModelFor,
  effortChoiceFor,
  isHostCloud,
  toCloudAgentOption,
  toEngineAgents,
} from '../lib/session-options';

/**
 * The engine button, bound to the draft: agent, model and effort. Switching
 * agent carries the model with it: a model belongs to one agent, so an agent
 * picked without one takes that agent's default. The effort slider is drawn
 * only for a model whose catalog row takes an effort — not the blank
 * terminal, not Claude's Haiku, not a vendor's cloud agent — over that
 * model's levels, with a pick kept per agent.
 *
 * Cursor's tab is its cloud agent (`NewSessionComposer.dc.html`: "Cloud
 * only"), shown once the reader has a key: picking one of its models moves
 * the session to the cloud, and picking a host agent's model from the cloud
 * moves it back to a new worktree on the host it left. In the cloud the
 * button names the vendor's agent and its model; the host agent waits in the
 * draft.
 *
 * A cloud started from a host runs Claude Code or Codex and nothing else
 * (`isHostCloud`), so there the button offers those two alone, and switching
 * between them switches whose cloud it is; the place chip picks the place
 * with its engine (`engineForPlace`).
 */
export function NewSessionAgent() {
  const { t } = useTranslation();
  const { control, setValue } = useNewSessionDraft();
  const [agent, model, cloudProvider, cloudModel] = useWatch({
    control,
    name: ['agent', 'model', 'cloudProvider', 'cloudModel'],
  });
  const atHostCloud = useWatch({
    control,
    name: ['where', 'cloudProvider'],
    compute: ([where, cloudProvider]) => isHostCloud({ where, cloudProvider }),
  });
  const { field: efforts } = useController({ control, name: 'efforts' });
  const [favourites, setFavourites] = useModelFavourites();
  const status = useCloudAgentStatus();
  // The vendor whose tab the button shows: the one picked, or else the first
  // the reader holds a key for.
  const vendor =
    cloudProvider ??
    status.data?.providers.find((provider) => provider.connected)?.id ??
    CLOUD_AGENT_PROVIDERS[0];
  const connected =
    status.data?.providers.some((provider) => provider.id === vendor && provider.connected) ??
    false;
  // Unconnected, the models are never asked for (`skipToken`).
  const models = useCloudAgentModels(vendor, connected);
  const cloudAgent = connected
    ? toCloudAgentOption(vendor, status.data, models.data ?? [], {
        auto: t('sessions.new.agent.auto'),
      })
    : null;
  const inCloud = cloudProvider !== null && cloudAgent !== null;

  return (
    <AgentSelect
      agents={toEngineAgents(atHostCloud, cloudAgent)}
      value={
        inCloud
          ? { agent: cloudAgent.id, model: cloudModel ?? CLOUD_DEFAULT_MODEL }
          : { agent, model }
      }
      onValueChange={(engine) => {
        if (!isCodingAgentId(engine.agent)) {
          setValue('cloudModel', engine.model === CLOUD_DEFAULT_MODEL ? null : engine.model);
          setValue('cloudProvider', vendor);
          setValue('where', 'cloud');
          return;
        }
        const next = engine.agent;
        if (cloudProvider !== null) {
          setValue('cloudProvider', null);
          setValue('where', 'worktree');
        }
        setValue('agent', next);
        setValue('model', engine.model ?? defaultModelFor(next));
      }}
      favourites={favourites}
      onFavouritesChange={setFavourites}
      effort={inCloud ? null : effortChoiceFor(agent, model, efforts.value[agent])}
      onEffortChange={(level) => efforts.onChange({ ...efforts.value, [agent]: level })}
    />
  );
}
