import type { Option } from 'oxide.ts';
import type { BotConversationSummaryEntity } from '../domain/bot-conversation-summary.entity';

export interface BotConversationSummaryRepositoryPort {
  /** The bot's summary, read for a turn or a summarizing job: the workspace is theirs. */
  findForBot(organizationId: string, botId: string): Promise<Option<BotConversationSummaryEntity>>;

  /**
   * Stores the summary, conditioned on the version it was loaded at and on
   * its cutoff being later than the stored one: a first summary only when
   * the bot has none, a revision only over the row it was read from. The
   * cutoff's time is taken from the message row. Whether this write won;
   * a loser writes nothing.
   */
  save(summary: BotConversationSummaryEntity): Promise<boolean>;

  /** Stages a job that folds the bot's oldest uncovered messages into its summary. */
  stageSummarize(
    organizationId: string,
    botId: string,
    correlationId: string | null,
  ): Promise<void>;
}
