import { AgentMark, Callout, ChipSelectItem, ChipSelectList } from '@oppenheimer/design-system-web';
import { useStoredList } from '@oppenheimer/frontend-web';
import {
  CODING_AGENTS,
  type CodingAgentId,
  codingAgentNamesConversation,
} from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { AGENT_CHOICES_KEY, shownAgents } from '../lib/agent-choices';

/**
 * The launcher's Agent pane: the coding agents this device offers (Settings →
 * Agents, as New session's engine picker reads them), less the blank
 * terminal, which is the launcher's own Terminal. Picking one starts it in a
 * new window of this session, in the same worktree, which the note above the
 * list says before anything is picked: two agents there edit the same files
 * and the same git index. The session's own agent is left out when its CLI
 * cannot name its conversation (`codingAgentNamesConversation`): a second
 * Codex would be read, and resumed, as the session's.
 */
export function SideAgentPicker({
  sessionAgent,
  onPick,
  opening,
}: {
  /** The agent window 0 runs. */
  sessionAgent: string;
  onPick: (agent: CodingAgentId) => void;
  /** The agent being started, while its window opens. */
  opening: CodingAgentId | null;
}) {
  const { t } = useTranslation();
  const [choices] = useStoredList(AGENT_CHOICES_KEY);
  const agents = shownAgents(choices).filter(
    (agent) => agent !== 'shell' && (agent !== sessionAgent || codingAgentNamesConversation(agent)),
  );

  return (
    <>
      <Callout tone="info">{t('sessions.side.launcher.agentShares')}</Callout>
      <ChipSelectList density="menu" role="listbox" aria-label={t('sessions.side.launcher.agents')}>
        {agents.map((agent) => {
          const label = CODING_AGENTS[agent].label;
          return (
            <ChipSelectItem
              key={agent}
              density="menu"
              leading={<AgentMark agent={agent} className="size-4" />}
              disabled={opening !== null}
              aria-busy={opening === agent ? true : undefined}
              onClick={() => onPick(agent)}
            >
              {opening === agent ? t('sessions.side.agent.opening', { agent: label }) : label}
            </ChipSelectItem>
          );
        })}
      </ChipSelectList>
    </>
  );
}
