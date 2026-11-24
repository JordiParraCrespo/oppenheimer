import { ApiProperty } from '@nestjs/swagger';
import {
  BOT_FORM_FIELD_KINDS,
  BOT_FORM_STATUSES,
  type BotFormFieldKind,
  type BotFormStatus,
} from '@oppenheimer/shared';

/** One field of a form. `min`, `max` and `options` are null on the kinds that have none. */
export class BotFormFieldResponseDto {
  @ApiProperty({ description: 'What the bot reads the value by.' })
  id!: string;

  @ApiProperty({ enum: BOT_FORM_FIELD_KINDS })
  kind!: BotFormFieldKind;

  @ApiProperty()
  label!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'An example shown in the empty field.',
  })
  placeholder!: string | null;

  @ApiProperty({ description: 'The form cannot be sent without it.' })
  required!: boolean;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'number' }],
    nullable: true,
    description: 'What the field starts with: a number for a `number`, words otherwise.',
  })
  default!: string | number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'A `number`’s smallest value.' })
  min!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'A `number`’s largest value.' })
  max!: number | null;

  @ApiProperty({ type: [String], nullable: true, description: 'A `select`’s options.' })
  options!: string[] | null;
}

/** A form a bot asked its owner to fill (`ask_form`). */
export class BotFormResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The turn whose call asked.' })
  turnId!: string;

  @ApiProperty({ description: 'What the form is for: its line in the chat.' })
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The button’s word; null for the default.',
  })
  submitLabel!: string | null;

  @ApiProperty({ type: [BotFormFieldResponseDto] })
  fields!: BotFormFieldResponseDto[];

  @ApiProperty({ enum: BOT_FORM_STATUSES })
  status!: BotFormStatus;

  @ApiProperty({
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }], nullable: true },
    nullable: true,
    description: 'A value per field id, once submitted; null for a field left blank.',
  })
  values!: Record<string, string | number | null> | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'What the person added to a dismissal.',
  })
  note!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  decidedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

/** `GET /bots/:id/form`: the form that waits, if one does. */
export class BotPendingFormResponseDto {
  @ApiProperty({ type: BotFormResponseDto, nullable: true })
  form!: BotFormResponseDto | null;
}
