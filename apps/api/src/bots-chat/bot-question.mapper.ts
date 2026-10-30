import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import {
  BOT_QUESTION_STATUSES,
  type BotQuestionAnswer,
  type BotQuestionStatus,
  botQuestionAnswerSchema,
  botQuestionsSchema,
  SCOPES,
  type Scope,
} from '@oppenheimer/shared';
import { BotQuestionOrmEntity } from './database/bot-question.orm-entity';
import { BotQuestionEntity } from './domain/bot-question.entity';
import { BotQuestionResponseDto } from './dtos/bot-question.response.dto';

@Injectable()
export class BotQuestionMapper
  implements Mapper<BotQuestionEntity, BotQuestionOrmEntity, BotQuestionResponseDto>
{
  toPersistence(entity: BotQuestionEntity): BotQuestionOrmEntity {
    const record = new BotQuestionOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.turnId = entity.turnId;
    record.questions = entity.questions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option })),
    }));
    record.summary = entity.summary;
    record.status = entity.status;
    record.answers = copyAnswers(entity.answers);
    record.note = entity.note;
    record.decidedByUserId = entity.decidedByUserId;
    record.decidedWithScopes = entity.decidedWithScopes ? [...entity.decidedWithScopes] : null;
    record.decidedAt = entity.decidedAt;
    return record;
  }

  toDomain(record: BotQuestionOrmEntity): BotQuestionEntity {
    const questions = botQuestionsSchema.safeParse(record.questions);
    return BotQuestionEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        turnId: record.turnId,
        questions: questions.success ? questions.data : [],
        summary: record.summary,
        status: asStatus(record.status),
        answers: asAnswers(record.answers),
        note: record.note,
        decidedByUserId: record.decidedByUserId,
        decidedWithScopes: asScopes(record.decidedWithScopes),
        decidedAt: record.decidedAt,
      },
    });
  }

  toResponse(entity: BotQuestionEntity): BotQuestionResponseDto {
    const dto = new BotQuestionResponseDto();
    dto.id = entity.id;
    dto.turnId = entity.turnId;
    dto.questions = entity.questions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option })),
    }));
    dto.summary = entity.summary;
    dto.status = entity.status;
    dto.answers = copyAnswers(entity.answers);
    dto.note = entity.note;
    dto.decidedAt = entity.decidedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

function copyAnswers(answers: readonly BotQuestionAnswer[] | null) {
  return answers
    ? answers.map((answer) => ({ picks: [...answer.picks], other: answer.other }))
    : null;
}

/** The stored status, narrowed once; an unknown one reads as expired, never as waiting. */
function asStatus(raw: string): BotQuestionStatus {
  return BOT_QUESTION_STATUSES.find((known) => known === raw) ?? 'expired';
}

/** The stored answers, narrowed once; an answer that does not read as one is dropped. */
function asAnswers(raw: unknown): BotQuestionAnswer[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((answer) => {
    const parsed = botQuestionAnswerSchema.safeParse(answer);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The stored scopes, narrowed once; an unknown one is dropped, never widened to all. */
function asScopes(raw: unknown): Scope[] | null {
  if (raw === null || raw === undefined) return null;
  return Array.isArray(raw)
    ? raw.filter((scope): scope is Scope => SCOPES.includes(scope as Scope))
    : [];
}
