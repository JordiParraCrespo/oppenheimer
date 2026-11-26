import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  HOST_EXEC_ALLOW_MAX,
  HOST_EXEC_MODES,
  HOST_SWITCH_STATES,
} from '@oppenheimer/shared/protocol';
import { z } from 'zod/v4';
import type { HostSettingsOutcome } from '../../sessions/application/host-settings.port';
import { SetHostSettingsCommand } from '../../sessions/commands/set-host-settings/set-host-settings.command';
import { promptText } from '../domain/bot-prompt-text.policy';
import {
  changesSomething,
  describeHostSettings,
  hostSettingsSummary,
  toHostSettingsChange,
} from './bot-host-settings.policy';
import { BotHostTargetResolver } from './bot-host-target.resolver';
import {
  type BotToolArea,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/**
 * The host's switches (`product/design/bots/bots.md` §4.2, "The host's switches"): a bot
 * turns a host's browser, screen or exec policy on or off when the person
 * asks it to, instead of telling them to type `runner browser on`. It is
 * offered only on the person's own turns in their chat (never a contact's,
 * a routine's or a wake's), so what a page, a mail or another person says
 * cannot reach it; under Approve for me every call is its own card.
 */
@Injectable()
export class BotHostSettingsToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists the tool. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly hosts: BotHostTargetResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.setHostSettings()];
  }

  private setHostSettings(): BotToolDefinition {
    return defineBotTool({
      name: 'set_host_settings',
      scope: 'sessions:write',
      asks: true,
      perCallOnly: true,
      ownerOnlyOn: ['message', 'telegram', 'whatsapp', 'slack'],
      description: promptText('sessions/tools-host-settings.set-host-settings'),
      input: z.object({
        browser: z
          .enum(HOST_SWITCH_STATES)
          .optional()
          .describe(promptText('sessions/tools-host-settings.set-host-settings-browser')),
        computer: z
          .enum(HOST_SWITCH_STATES)
          .optional()
          .describe(promptText('sessions/tools-host-settings.set-host-settings-computer')),
        exec_mode: z
          .enum(HOST_EXEC_MODES)
          .optional()
          .describe(promptText('sessions/tools-host-settings.set-host-settings-exec-mode')),
        exec_allow: z
          .array(z.string().min(1).max(1_024).regex(/^\S+$/))
          .min(1)
          .max(HOST_EXEC_ALLOW_MAX)
          .optional()
          .describe(promptText('sessions/tools-host-settings.set-host-settings-exec-allow')),
        host_id: z
          .uuid()
          .optional()
          .describe(promptText('sessions/tools-host-settings.set-host-settings-host-id')),
      }),
      normalize: async (input, context) => {
        if (!changesSomething(input)) {
          throw new BotToolRefusal(promptText('sessions/tools-host-settings.nothing-to-change'));
        }
        return { ...input, host_id: await this.hosts.usable(input, context) };
      },
      summarize: async (input, context) =>
        hostSettingsSummary(input, await this.hosts.name(context, this.hosts.idOf(input, context))),
      run: async (input, context) => {
        const hostId = this.hosts.idOf(input, context);
        const outcome = await this.commandBus.execute<SetHostSettingsCommand, HostSettingsOutcome>(
          new SetHostSettingsCommand({
            scope: context.owner,
            hostId,
            change: toHostSettingsChange(input),
          }),
        );
        return describeHostSettings(outcome, await this.hosts.name(context, hostId));
      },
    });
  }
}
