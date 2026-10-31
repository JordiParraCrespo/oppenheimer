import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotQuestionAnswer, Scope } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class AnswerBotQuestionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly questionId: string;
  /** One per question, in order. */
  readonly answers: readonly BotQuestionAnswer[];
  /** Who answered, as the bot is told: the caller's name. */
  readonly deciderName: string;
  /** The answering credential's scopes; null for a browser session. */
  readonly credentialScopes: readonly Scope[] | null;

  constructor(props: CommandProps<AnswerBotQuestionCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.questionId = props.questionId;
    this.answers = props.answers;
    this.deciderName = props.deciderName;
    this.credentialScopes = props.credentialScopes ?? null;
  }
}
