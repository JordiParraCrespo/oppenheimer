import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import {
  BOT_FORM_STATUSES,
  type BotFormField,
  type BotFormSpec,
  type BotFormStatus,
  type BotFormValues,
  botFormSpecSchema,
  botFormValueSchema,
  SCOPES,
  type Scope,
} from '@oppenheimer/shared';
import { BotFormOrmEntity } from './database/bot-form.orm-entity';
import { BotFormEntity } from './domain/bot-form.entity';
import {
  BotFormFieldResponseDto,
  BotFormResponseDto,
  BotPendingFormResponseDto,
} from './dtos/bot-form.response.dto';

@Injectable()
export class BotFormMapper implements Mapper<BotFormEntity, BotFormOrmEntity, BotFormResponseDto> {
  toPersistence(entity: BotFormEntity): BotFormOrmEntity {
    const record = new BotFormOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.turnId = entity.turnId;
    record.spec = copySpec(entity.spec);
    record.summary = entity.summary;
    record.status = entity.status;
    record.values = entity.values ? { ...entity.values } : null;
    record.note = entity.note;
    record.decidedByUserId = entity.decidedByUserId;
    record.decidedWithScopes = entity.decidedWithScopes ? [...entity.decidedWithScopes] : null;
    record.decidedAt = entity.decidedAt;
    return record;
  }

  toDomain(record: BotFormOrmEntity): BotFormEntity {
    return BotFormEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        turnId: record.turnId,
        spec: asSpec(record.spec, record.summary),
        status: asStatus(record.status),
        values: asValues(record.values),
        note: record.note,
        decidedByUserId: record.decidedByUserId,
        decidedWithScopes: asScopes(record.decidedWithScopes),
        decidedAt: record.decidedAt,
      },
    });
  }

  toResponse(entity: BotFormEntity): BotFormResponseDto {
    const dto = new BotFormResponseDto();
    dto.id = entity.id;
    dto.turnId = entity.turnId;
    dto.title = entity.spec.title;
    dto.description = entity.spec.description;
    dto.submitLabel = entity.spec.submitLabel;
    dto.fields = entity.spec.fields.map(toFieldResponse);
    dto.status = entity.status;
    dto.values = entity.values ? { ...entity.values } : null;
    dto.note = entity.note;
    dto.decidedAt = entity.decidedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }

  /** `GET /bots/:id/form`: the waiting form, or null. */
  toPendingResponse(entity: BotFormEntity | null): BotPendingFormResponseDto {
    const dto = new BotPendingFormResponseDto();
    dto.form = entity ? this.toResponse(entity) : null;
    return dto;
  }
}

/** One field as the response carries it: every kind's keys, null where its kind has none. */
function toFieldResponse(field: BotFormField): BotFormFieldResponseDto {
  const dto = new BotFormFieldResponseDto();
  dto.id = field.id;
  dto.kind = field.kind;
  dto.label = field.label;
  dto.placeholder = field.placeholder;
  dto.required = field.required;
  dto.default = field.default;
  dto.min = field.kind === 'number' ? field.min : null;
  dto.max = field.kind === 'number' ? field.max : null;
  dto.options = field.kind === 'select' ? [...field.options] : null;
  return dto;
}

function copySpec(spec: BotFormSpec): BotFormSpec {
  return {
    ...spec,
    fields: spec.fields.map((field) =>
      field.kind === 'select' ? { ...field, options: [...field.options] } : { ...field },
    ),
  };
}

/** The stored form, narrowed once; one that no longer reads keeps its title and a single blank line. */
function asSpec(raw: unknown, summary: string): BotFormSpec {
  const parsed = botFormSpecSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return {
    title: summary,
    description: null,
    submitLabel: null,
    fields: [
      {
        id: 'answer',
        kind: 'textarea',
        label: summary,
        placeholder: null,
        required: false,
        default: null,
      },
    ],
  };
}

/** The stored status, narrowed once; an unknown one reads as expired, never as waiting. */
function asStatus(raw: string): BotFormStatus {
  return BOT_FORM_STATUSES.find((known) => known === raw) ?? 'expired';
}

/** The stored values, narrowed once; a value that does not read as one is dropped. */
function asValues(raw: unknown): BotFormValues | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const values: BotFormValues = {};
  for (const [key, value] of Object.entries(raw)) {
    const parsed = botFormValueSchema.safeParse(value);
    if (parsed.success) values[key] = parsed.data;
  }
  return values;
}

/** The stored scopes, narrowed once; an unknown one is dropped, never widened to all. */
function asScopes(raw: unknown): Scope[] | null {
  if (raw === null || raw === undefined) return null;
  return Array.isArray(raw)
    ? raw.filter((scope): scope is Scope => SCOPES.includes(scope as Scope))
    : [];
}
