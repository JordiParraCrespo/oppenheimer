import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { createSessionSchema } from '@oppenheimer/shared';
import {
  TERMINAL_HISTORY_MAX_LINES,
  TERMINAL_KEYS,
  TERMINAL_TEXT_MAX,
  TERMINAL_WAIT_MAX_SECONDS,
  TERMINAL_WATCH_PATTERN_MAX,
} from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import type { SessionTerminalOutcome } from '../../sessions/application/session-terminal.port';
import { CreateSessionCommand } from '../../sessions/commands/create-session/create-session.command';
import { DriveSessionTerminalCommand } from '../../sessions/commands/drive-session-terminal/drive-session-terminal.command';
import type { SessionCommandResult } from '../../sessions/domain/session-command.types';
import { invalidBodyRefusal } from '../bot-session-tool.mapper';
import {
  DEFAULT_TERMINAL_WAIT_SECONDS,
  type TerminalToolInput,
  terminalCommandIdOf,
  toTerminalDriveRequest,
} from '../bot-terminal-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import { BOT_SESSION_PERMISSION } from '../domain/bot-session-launch.policy';
import { idempotencyKeyOf } from '../domain/bot-tool-idempotency.policy';
import { BotHostTargetResolver } from './bot-host-target.resolver';
import { describeTerminal, terminalTypeSummary } from './bot-terminal.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

const sessionId = z.uuid().describe(promptText('tools/terminal.session-id'));

const waitFields = {
  wait_for: z
    .string()
    .min(1)
    .max(TERMINAL_WATCH_PATTERN_MAX)
    .optional()
    .describe(promptText('tools/terminal.wait-fields-wait-for')),
  wait_seconds: z
    .number()
    .int()
    .min(0)
    .max(TERMINAL_WAIT_MAX_SECONDS)
    .optional()
    .describe(
      promptText('tools/terminal.wait-fields-wait-seconds', {
        defaultTerminalWaitSeconds: String(DEFAULT_TERMINAL_WAIT_SECONDS),
        terminalWaitMaxSeconds: String(TERMINAL_WAIT_MAX_SECONDS),
      }),
    ),
  history: z
    .number()
    .int()
    .min(0)
    .max(TERMINAL_HISTORY_MAX_LINES)
    .optional()
    .describe(promptText('tools/terminal.wait-fields-history')),
};

/**
 * Driving a terminal: a bot opens a blank terminal (a session whose window 0 is
 * a plain shell) on a host, types into it as a person would, and reads the
 * screen back, so it can run bash, ssh into a machine, answer a program's
 * questions or watch a long job. The session is an ordinary one: the person
 * sees it in the console and can take over. A host lets a bot drive a shell
 * only when its own exec policy is `full`.
 */
@Injectable()
export class BotTerminalToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly hosts: BotHostTargetResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.openTerminal(), this.typeInTerminal(), this.readTerminal()];
  }

  private openTerminal(): BotToolDefinition {
    return defineBotTool({
      name: 'open_terminal',
      scope: 'sessions:write',
      asks: true,
      description: promptText('tools/terminal.open-terminal'),
      input: z.object({
        folder: z
          .string()
          .regex(/^\/[^\0]*$/)
          .max(1_024)
          .describe(promptText('tools/terminal.open-terminal-folder')),
        host_id: z.uuid().optional().describe(promptText('tools/terminal.open-terminal-host-id')),
        name: z
          .string()
          .min(1)
          .max(80)
          .optional()
          .describe(promptText('tools/terminal.open-terminal-name')),
      }),
      normalize: async (input, context) => ({
        ...input,
        host_id: await this.hosts.usable(input, context),
      }),
      summarize: async (input, context) =>
        `Open a terminal on ${await this.hosts.name(context, input.host_id ?? '')} in ${input.folder}`,
      run: async (input, context) => {
        const hostId = await this.hosts.usable(input, context);
        const parsed = createSessionSchema.safeParse({
          hostId,
          agent: 'shell',
          name: input.name ?? 'Terminal',
          launch: { permission: BOT_SESSION_PERMISSION },
          folder: input.folder,
        });
        if (!parsed.success) {
          throw new BotToolRefusal(
            invalidBodyRefusal(parsed.error.issues, 'Check the folder and name.'),
          );
        }
        const result = await this.commandBus.execute<CreateSessionCommand, SessionCommandResult>(
          new CreateSessionCommand({
            scope: context.owner,
            userId: context.owner.userId,
            input: parsed.data,
            idempotencyKey: idempotencyKeyOf(context.turnId, parsed.data, context.approvalId),
            origin: 'bot',
            botId: context.botId,
          }),
        );
        const offline = result.hints.includes('host_offline')
          ? ` ${promptText('tools/terminal.open-terminal-host-offline-opens')}`
          : '';
        return {
          content: promptText('tools/terminal.open-terminal-content', {
            sessionId: result.sessionId,
            hostId,
            folder: input.folder,
            offline,
          }),
          sessionId: result.sessionId,
        };
      },
    });
  }

  private typeInTerminal(): BotToolDefinition {
    return defineBotTool({
      name: 'type_in_terminal',
      scope: 'sessions:write',
      asks: true,
      subject: (input) => ({
        kind: 'session',
        key: input.session_id,
        label: `terminal ${input.session_id}`,
      }),
      description: promptText('tools/terminal.type-in-terminal'),
      input: z.object({
        session_id: sessionId,
        text: z.string().max(TERMINAL_TEXT_MAX).optional().describe('Text to type, literally.'),
        keys: z
          .array(z.enum(TERMINAL_KEYS))
          .max(32)
          .optional()
          .describe(promptText('tools/terminal.type-in-terminal-keys')),
        ...waitFields,
      }),
      summarize: (input) => terminalTypeSummary(input.session_id, input.text, input.keys),
      run: async (input, context) => {
        if (!input.text && !input.keys?.length) {
          throw new BotToolRefusal(promptText('tools/terminal.type-in-terminal-nothing-type-give'));
        }
        return describeTerminal(await this.drive(context, input), input.session_id);
      },
    });
  }

  private readTerminal(): BotToolDefinition {
    return defineBotTool({
      name: 'read_terminal',
      scope: 'sessions:read',
      readOnly: true,
      description: promptText('tools/terminal.read-terminal'),
      input: z.object({ session_id: sessionId, ...waitFields }),
      run: async (input, context) =>
        describeTerminal(await this.drive(context, input), input.session_id),
    });
  }

  private drive(
    context: BotToolCallContext & { approvalId?: string },
    input: TerminalToolInput & { session_id: string },
  ): Promise<SessionTerminalOutcome> {
    return this.commandBus.execute<DriveSessionTerminalCommand, SessionTerminalOutcome>(
      new DriveSessionTerminalCommand({
        scope: context.owner,
        sessionId: input.session_id,
        request: toTerminalDriveRequest(input),
        ...(context.approvalId ? { commandId: terminalCommandIdOf(context.approvalId) } : {}),
      }),
    );
  }
}
