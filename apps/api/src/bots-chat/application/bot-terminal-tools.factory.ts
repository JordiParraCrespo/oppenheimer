import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { createSessionSchema } from '@oppenheimer/shared';
import {
  TERMINAL_HISTORY_MAX_LINES,
  TERMINAL_KEYS,
  TERMINAL_TEXT_MAX,
  TERMINAL_WAIT_MAX_SECONDS,
  TERMINAL_WATCH_PATTERN_MAX,
} from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import { FindHostQuery } from '../../hosts/queries/find-host/find-host.query';
import type { SessionTerminalOutcome } from '../../sessions/application/session-terminal.port';
import { CreateSessionCommand } from '../../sessions/commands/create-session/create-session.command';
import { DriveSessionTerminalCommand } from '../../sessions/commands/drive-session-terminal/drive-session-terminal.command';
import type { SessionCommandResult } from '../../sessions/domain/session-command.types';
import { BOT_SESSION_PERMISSION, invalidBodyRefusal } from '../bot-session-tool.mapper';
import {
  DEFAULT_TERMINAL_WAIT_SECONDS,
  type TerminalToolInput,
  terminalCommandIdOf,
  toTerminalDriveRequest,
} from '../bot-terminal-tool.mapper';
import { idempotencyKeyOf } from '../domain/bot-tool-idempotency.policy';
import { describeTerminal, terminalTypeSummary } from './bot-terminal.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

const sessionId = z.uuid().describe('The terminal session (from open_terminal or list_sessions).');

const waitFields = {
  wait_for: z
    .string()
    .min(1)
    .max(TERMINAL_WATCH_PATTERN_MAX)
    .optional()
    .describe(
      'A regular expression (RE2) to wait for on a line of the screen, such as your prompt coming back (`\\$ $`) or `password:`. Without it the call waits wait_seconds.',
    ),
  wait_seconds: z
    .number()
    .int()
    .min(0)
    .max(TERMINAL_WAIT_MAX_SECONDS)
    .optional()
    .describe(
      `How long to wait, at most, before reading the screen; ${DEFAULT_TERMINAL_WAIT_SECONDS} when omitted, at most ${TERMINAL_WAIT_MAX_SECONDS}.`,
    ),
  history: z
    .number()
    .int()
    .min(0)
    .max(TERMINAL_HISTORY_MAX_LINES)
    .optional()
    .describe('How many lines above the visible screen to read too.'),
};

/**
 * Driving a terminal (`25-bots.md` §4.2): a bot opens a blank terminal (a
 * session whose window 0 is a plain shell) on a host, types into it as a
 * person would, and reads the screen back, so it can run bash, ssh into a
 * machine, answer a program's questions or watch a long job. The session is
 * an ordinary one: the person sees it in the console and can take over. A
 * host lets a bot drive a shell only when its own exec policy is `full`.
 */
@Injectable()
export class BotTerminalToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.openTerminal(), this.typeInTerminal(), this.readTerminal()];
  }

  private openTerminal(): BotToolDefinition {
    return defineBotTool({
      name: 'open_terminal',
      scope: 'sessions:write',
      asks: true,
      description:
        "Opens a blank terminal (a plain shell, no coding agent) on one of the person's hosts, in a folder already there, and returns its session id for type_in_terminal and read_terminal. Use it for interactive work a single run_command cannot do: an ssh login, a program that asks questions, a REPL, a job you watch. The person sees it in the console like any session and can take over. The host must allow it (its exec mode is full). The host defaults to your home host.",
      input: z.object({
        folder: z
          .string()
          .regex(/^\/[^\0]*$/)
          .max(1_024)
          .describe(
            'An absolute folder on the host to start in: your own folder there (the cwd run_command reports), or one from list_folders.',
          ),
        host_id: z
          .uuid()
          .optional()
          .describe('The host (from list_hosts); your home host when omitted.'),
        name: z.string().min(1).max(80).optional().describe('A short name for the terminal.'),
      }),
      normalize: async (input, context) => ({
        ...input,
        host_id: await this.hostOf(input, context),
      }),
      summarize: async (input, context) =>
        `Open a terminal on ${await this.hostName(context, input.host_id ?? '')} in ${input.folder}`,
      run: async (input, context) => {
        const hostId = await this.hostOf(input, context);
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
          }),
        );
        const offline = result.hints.includes('host_offline')
          ? ' The host is offline: it opens when the host comes back.'
          : '';
        return {
          content: `Opened terminal ${result.sessionId} on host ${hostId} in ${input.folder}.${offline} Read it with read_terminal (wait_for your prompt) before you type.`,
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
      description: `Types into a terminal from open_terminal, as a person would, then waits and returns the screen. text is typed literally (a command line, an answer); keys are pressed after it by name: Enter to run it, C-c to interrupt, C-d to end input, Tab, Escape, arrows. So a command is text plus keys ["Enter"]. Wait for something that shows the command finished (wait_for your prompt, or a program's question) rather than a fixed time. Never type a password or secret: when a program asks for one, tell the person and let them type it in the console.`,
      input: z.object({
        session_id: sessionId,
        text: z.string().max(TERMINAL_TEXT_MAX).optional().describe('Text to type, literally.'),
        keys: z
          .array(z.enum(TERMINAL_KEYS))
          .max(32)
          .optional()
          .describe('Keys to press after the text, in order, e.g. ["Enter"].'),
        ...waitFields,
      }),
      summarize: (input) => terminalTypeSummary(input.session_id, input.text, input.keys),
      run: async (input, context) => {
        if (!input.text && !input.keys?.length) {
          throw new BotToolRefusal(
            'Nothing to type: give text, keys or both. To only look, use read_terminal.',
          );
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
      description:
        'Reads the screen of a terminal from open_terminal, optionally after waiting for a pattern to show (a job finishing, a prompt coming back). It types nothing.',
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

  /** The named host or the home host, refused in words when it is neither the owner's nor set. */
  private async hostOf(input: { host_id?: string }, context: BotToolCallContext): Promise<string> {
    const hostId = input.host_id ?? context.homeHostId;
    if (!hostId) {
      throw new BotToolRefusal(
        'No host named and you have no home host: ask which host to use, and say they can set one in Settings → Home host.',
      );
    }
    const found = await this.queryBus
      .execute(new FindHostQuery({ scope: context.owner, hostId }))
      .then(() => true)
      .catch(() => false);
    if (!found) {
      throw new BotToolRefusal(
        `${hostId} is not one of the person's hosts. Leave host_id out to use your home host, or take one from list_hosts; never make one up.`,
      );
    }
    return hostId;
  }

  private async hostName(context: BotToolCallContext, hostId: string): Promise<string> {
    const overview = await this.queryBus
      .execute<FindHostQuery, { host: { name: string } }>(
        new FindHostQuery({ scope: context.owner, hostId }),
      )
      .catch(() => null);
    return overview?.host.name ?? `host ${hostId}`;
  }
}
