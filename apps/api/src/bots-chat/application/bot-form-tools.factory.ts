import { Inject, Injectable } from '@nestjs/common';
import {
  BOT_FORM_DESCRIPTION_MAX,
  BOT_FORM_FIELD_KINDS,
  BOT_FORM_FIELD_LABEL_MAX,
  BOT_FORM_FIELD_PLACEHOLDER_MAX,
  BOT_FORM_FIELDS_MAX,
  BOT_FORM_FIELDS_MIN,
  BOT_FORM_SELECT_OPTION_MAX,
  BOT_FORM_SELECT_OPTIONS_MAX,
  BOT_FORM_SELECT_OPTIONS_MIN,
  BOT_FORM_SUBMIT_LABEL_MAX,
  BOT_FORM_TEXTAREA_MAX,
  BOT_FORM_TITLE_MAX,
  botFormSpecSchema,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { BOT_FORM_REPOSITORY, BOT_STREAM } from '../bots-chat.di-tokens';
import type { BotFormRepositoryPort } from '../database/bot-form.repository.port';
import { BotFormEntity } from '../domain/bot-form.entity';
import { askedForm, formNotAsked, waitingForForm } from '../domain/bot-form.policy';
import { formSpecProblem } from '../domain/bot-form-values.policy';
import { promptText } from '../domain/bot-prompt-text.policy';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/**
 * One field as the model writes it: flat, every kind's keys optional, so a
 * model that sends `min` on a text field is not refused for it. The shared
 * schema then reads it by its kind, keeping only what the kind takes.
 */
const askFormField = z.object({
  id: z.string().min(1).max(32).describe(promptText('tools/forms.field-id')),
  kind: z.enum(BOT_FORM_FIELD_KINDS).describe(promptText('tools/forms.field-kind')),
  label: z
    .string()
    .min(1)
    .max(BOT_FORM_FIELD_LABEL_MAX)
    .describe(promptText('tools/forms.field-label')),
  placeholder: z
    .string()
    .max(BOT_FORM_FIELD_PLACEHOLDER_MAX)
    .optional()
    .describe(promptText('tools/forms.field-placeholder')),
  required: z.boolean().optional().describe(promptText('tools/forms.field-required')),
  default: z
    .union([z.string().max(BOT_FORM_TEXTAREA_MAX), z.number()])
    .optional()
    .describe(promptText('tools/forms.field-default')),
  min: z.number().optional().describe(promptText('tools/forms.field-min')),
  max: z.number().optional().describe(promptText('tools/forms.field-max')),
  options: z
    .array(z.string().min(1).max(BOT_FORM_SELECT_OPTION_MAX))
    .max(BOT_FORM_SELECT_OPTIONS_MAX)
    .optional()
    .describe(
      promptText('tools/forms.field-options', {
        optionsMin: String(BOT_FORM_SELECT_OPTIONS_MIN),
        optionsMax: String(BOT_FORM_SELECT_OPTIONS_MAX),
      }),
    ),
});

/** The form `ask_form` puts to the person. */
const askFormInput = z.object({
  title: z.string().min(1).max(BOT_FORM_TITLE_MAX).describe(promptText('tools/forms.title')),
  description: z
    .string()
    .max(BOT_FORM_DESCRIPTION_MAX)
    .optional()
    .describe(promptText('tools/forms.description')),
  fields: z
    .array(askFormField)
    .min(BOT_FORM_FIELDS_MIN)
    .max(BOT_FORM_FIELDS_MAX)
    .describe(promptText('tools/forms.fields')),
  submitLabel: z
    .string()
    .max(BOT_FORM_SUBMIT_LABEL_MAX)
    .optional()
    .describe(promptText('tools/forms.submit-label')),
});
type AskFormInput = z.infer<typeof askFormInput>;

/** The model's flat fields, each read by its kind: the keys its kind has no use for go. */
function specInput(input: AskFormInput): unknown {
  return {
    ...input,
    fields: input.fields.map(({ min, max, options, ...field }) => ({
      ...field,
      ...(field.kind === 'number' && { min, max }),
      ...(field.kind === 'select' && { options }),
    })),
  };
}

/**
 * A form for the person (`ask_form`): several values at once, typed, on a
 * card of its own in the chat. It ends the turn, and what they send opens
 * the next one. Like a card of questions it is not an approval: nothing runs
 * on it, it is submitted or dismissed, and the bot has one card up at a time
 * of any kind. Offered only on a turn a person is waiting on.
 */
@Injectable()
export class BotFormToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'self' as const;

  constructor(
    @Inject(BOT_FORM_REPOSITORY) private readonly forms: BotFormRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      defineBotTool({
        name: 'ask_form',
        scope: 'bots:write',
        attendedOnly: true,
        description: promptText('tools/forms.ask-form', {
          fieldsMin: String(BOT_FORM_FIELDS_MIN),
          fieldsMax: String(BOT_FORM_FIELDS_MAX),
        }),
        input: askFormInput,
        run: async (input, context) => {
          const parsed = botFormSpecSchema.safeParse(specInput(input));
          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            return formNotAsked(`${issue?.path.join('.') ?? 'form'}: ${issue?.message ?? ''}`);
          }
          const problem = formSpecProblem(parsed.data);
          if (problem) return formNotAsked(problem);
          const form = BotFormEntity.ask({
            organizationId: context.organizationId,
            botId: context.botId,
            turnId: context.turnId,
            spec: parsed.data,
          });
          const stored = await this.forms.insertPending(form);
          if (stored !== 'inserted') return waitingForForm(stored.waiting);
          await this.stream.publish(context.botId, {
            type: 'form',
            formId: form.id,
            status: 'pending',
          });
          return askedForm(parsed.data.fields.length);
        },
      }),
    ];
  }
}
