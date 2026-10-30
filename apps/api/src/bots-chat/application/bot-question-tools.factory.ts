import { Inject, Injectable } from '@nestjs/common';
import {
  BOT_QUESTION_HEADER_MAX,
  BOT_QUESTION_OPTION_DESCRIPTION_MAX,
  BOT_QUESTION_OPTION_LABEL_MAX,
  BOT_QUESTION_OPTIONS_MAX,
  BOT_QUESTION_OPTIONS_MIN,
  BOT_QUESTION_TEXT_MAX,
  BOT_QUESTIONS_MAX,
  botQuestionsSchema,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { BOT_QUESTION_REPOSITORY, BOT_STREAM } from '../bots-chat.di-tokens';
import type { BotQuestionRepositoryPort } from '../database/bot-question.repository.port';
import { BotQuestionEntity } from '../domain/bot-question.entity';
import { askedQuestions, questionsSummary, waitingForAnswer } from '../domain/bot-question.policy';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/** The questions `ask_user` puts to the person, the shape of Claude Code's `AskUserQuestion`. */
const askUserInput = z.object({
  questions: z
    .array(
      z.object({
        header: z
          .string()
          .max(BOT_QUESTION_HEADER_MAX)
          .optional()
          .describe('A tag of a word or two over the question ("Scope", "Deadline").'),
        question: z
          .string()
          .min(1)
          .max(BOT_QUESTION_TEXT_MAX)
          .describe('The question, ending in "?".'),
        multiSelect: z
          .boolean()
          .optional()
          .describe('True when several options may be picked; one otherwise.'),
        options: z
          .array(
            z.object({
              label: z.string().min(1).max(BOT_QUESTION_OPTION_LABEL_MAX),
              description: z
                .string()
                .max(BOT_QUESTION_OPTION_DESCRIPTION_MAX)
                .optional()
                .describe('What picking it means, when the label does not say.'),
            }),
          )
          .min(BOT_QUESTION_OPTIONS_MIN)
          .max(BOT_QUESTION_OPTIONS_MAX)
          .describe('The likely answers. The person may always answer in their own words instead.'),
      }),
    )
    .min(1)
    .max(BOT_QUESTIONS_MAX),
});

/**
 * Questions for the person (`25-bots.md` §3.2; Claude Code's
 * `AskUserQuestion`): `ask_user` puts them on a card of their own in the
 * chat and ends the turn, and the answers open the next one. A card of
 * questions is not an approval: nothing runs on it, it is answered or
 * dismissed, and the bot has one card up at a time of either kind. Offered
 * only on a turn a person is waiting on.
 */
@Injectable()
export class BotQuestionToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'self' as const;

  constructor(
    @Inject(BOT_QUESTION_REPOSITORY) private readonly questions: BotQuestionRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      defineBotTool({
        name: 'ask_user',
        scope: 'bots:write',
        attendedOnly: true,
        description: `Asks the person up to ${BOT_QUESTIONS_MAX} questions on a card in the chat, each with ${BOT_QUESTION_OPTIONS_MIN} to ${BOT_QUESTION_OPTIONS_MAX} likely answers, and ends your turn; their answers open your next one. Use it when you cannot go on without a choice only they can make (which of two repositories, a deadline, what to leave out), rather than guessing. Do not use it for a yes to an action: the actions that need one ask on their own. One card waits at a time.`,
        input: askUserInput,
        run: async (input, context) => {
          const questions = botQuestionsSchema.parse(input.questions);
          const card = BotQuestionEntity.ask({
            organizationId: context.organizationId,
            botId: context.botId,
            turnId: context.turnId,
            questions,
            summary: questionsSummary(questions),
          });
          const stored = await this.questions.insertPending(card);
          if (stored !== 'inserted') return waitingForAnswer(stored.waiting);
          await this.stream.publish(context.botId, {
            type: 'question',
            questionId: card.id,
            status: 'pending',
          });
          return askedQuestions(questions.length);
        },
      }),
    ];
  }
}
