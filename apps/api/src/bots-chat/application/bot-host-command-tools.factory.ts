import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  HOST_EXEC_DEFAULT_TIMEOUT_SECONDS,
  HOST_EXEC_MAX_ARG_LENGTH,
  HOST_EXEC_MAX_ARGS,
} from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import type { HostExecOutcome } from '../../sessions/application/host-exec.port';
import { RunHostCommandCommand } from '../../sessions/commands/run-host-command/run-host-command.command';
import { promptText } from '../domain/bot-prompt-text.policy';
import {
  describeHostCommand,
  hostCommandIdOf,
  hostCommandSummary,
} from './bot-host-command.policy';
import { BotHostTargetResolver } from './bot-host-target.resolver';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/**
 * The longest one `run_command` may take, in seconds: well inside a turn's
 * four minutes, so the answer comes back to the turn that asked. Longer work
 * is a session.
 */
export const RUN_COMMAND_MAX_TIMEOUT_SECONDS = 120;

/**
 * Commands on a host: one program, run on one of the owner's hosts by its
 * runner, its output read back in the same turn. It reaches outside
 * Oppenheimer, so under Auto it asks first; and whatever the bot's
 * permissions say, the host runs only what its own policy (`runner exec`)
 * allows, which is off until the person on the host turns it on.
 */
@Injectable()
export class BotHostCommandToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly hosts: BotHostTargetResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.runCommand()];
  }

  private runCommand(): BotToolDefinition {
    return defineBotTool({
      name: 'run_command',
      scope: 'sessions:write',
      asks: true,
      description: promptText('sessions/tools-host-command.run-command', {
        runCommandMaxTimeoutSeconds: String(RUN_COMMAND_MAX_TIMEOUT_SECONDS),
      }),
      input: z.object({
        argv: z
          .array(z.string().min(1).max(HOST_EXEC_MAX_ARG_LENGTH))
          .min(1)
          .max(HOST_EXEC_MAX_ARGS)
          .describe(promptText('sessions/tools-host-command.run-command-argv')),
        host_id: z
          .uuid()
          .optional()
          .describe(promptText('sessions/tools-host-command.run-command-host-id')),
        cwd: z
          .string()
          .regex(/^\/[^\0]*$/)
          .max(1_024)
          .optional()
          .describe(promptText('sessions/tools-host-command.run-command-cwd')),
        timeout_seconds: z
          .number()
          .int()
          .min(1)
          .max(RUN_COMMAND_MAX_TIMEOUT_SECONDS)
          .optional()
          .describe(
            promptText('sessions/tools-host-command.run-command-timeout-seconds', {
              hostExecDefaultTimeoutSeconds: String(HOST_EXEC_DEFAULT_TIMEOUT_SECONDS),
            }),
          ),
      }),
      normalize: async (input, context) => ({
        ...input,
        host_id: await this.hosts.usable(input, context),
      }),
      subject: async (input, context) => {
        const hostId = this.hosts.idOf(input, context);
        const program = input.argv[0] ?? '';
        // Hashed, so a standing yes is for this program alone: a grant's key
        // is cut to fit its column, and a cut path would match any program
        // that shares its start.
        return {
          kind: 'host_program',
          key: `${hostId}:${createHash('sha256').update(program).digest('hex')}`,
          label: `${program} on ${await this.hosts.name(context, hostId)}`,
        };
      },
      summarize: async (input, context) => {
        const host = await this.hosts.name(context, this.hosts.idOf(input, context));
        return hostCommandSummary(input.argv, host, input.cwd);
      },
      run: async (input, context) => {
        const hostId = this.hosts.idOf(input, context);
        const outcome = await this.commandBus.execute<RunHostCommandCommand, HostExecOutcome>(
          new RunHostCommandCommand({
            scope: context.owner,
            hostId,
            ...(context.approvalId ? { commandId: hostCommandIdOf(context.approvalId) } : {}),
            request: {
              argv: input.argv,
              ...(input.cwd ? { cwd: input.cwd } : {}),
              home: context.botId.toLowerCase(),
              timeoutSeconds: input.timeout_seconds ?? HOST_EXEC_DEFAULT_TIMEOUT_SECONDS,
            },
          }),
        );
        return describeHostCommand(outcome, await this.hosts.name(context, hostId));
      },
    });
  }
}
