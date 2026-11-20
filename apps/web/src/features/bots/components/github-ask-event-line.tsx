import { TranscriptDivider } from '@oppenheimer/design-system-web';
import { AtSign, Tag } from '@oppenheimer/design-system-web/icons';
import type { BotGithubAskEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/** The line's words by how the bot was asked. */
const GITHUB_ASK_KEYS = {
  mention: 'bots.chat.event.githubAsk.mention',
  label: 'bots.chat.event.githubAsk.label',
} as const;

const GITHUB_ASK_ICONS = {
  mention: <AtSign />,
  label: <Tag />,
} as const;

/**
 * You asked the bot on GitHub: "Asked on GitHub, in a comment on #128 of
 * acme/app", linking to the comment, or the issue a label was added to. The
 * turn after it is the bot's answer, which is posted there too.
 */
export function GithubAskEventLine({ event }: { event: BotGithubAskEvent }) {
  const { t } = useTranslation();
  const line = t(GITHUB_ASK_KEYS[event.via], {
    number: event.number,
    repository: event.repository,
  });
  return (
    <TranscriptDivider icon={GITHUB_ASK_ICONS[event.via]}>
      {event.url ? (
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer"
          className="max-w-xl truncate underline-offset-2 hover:text-fg hover:underline"
          title={line}
        >
          {line}
        </a>
      ) : (
        <span className="max-w-xl truncate" title={line}>
          {line}
        </span>
      )}
    </TranscriptDivider>
  );
}
