import type {
  HostSettingsChange,
  HostSettingsOutcome,
} from '../../sessions/application/host-settings.port';
import { promptText } from '../domain/bot-prompt-text.policy';
import { cut } from '../domain/bot-tool-text.policy';

/** A `set_host_settings` call as its words are drawn from. */
export interface HostSettingsCall {
  browser?: 'on' | 'off';
  computer?: 'on' | 'off';
  exec_mode?: 'off' | 'allowlist' | 'full';
  exec_allow?: readonly string[];
}

/** What the runner is sent for a call: only the fields it gives. */
export function toHostSettingsChange(call: HostSettingsCall): HostSettingsChange {
  return {
    ...(call.browser ? { browser: call.browser } : {}),
    ...(call.computer ? { computer: call.computer } : {}),
    ...(call.exec_mode ? { execMode: call.exec_mode } : {}),
    ...(call.exec_allow?.length ? { execAllow: [...call.exec_allow] } : {}),
  };
}

/** Whether the call changes anything at all. */
export function changesSomething(call: HostSettingsCall): boolean {
  return Object.keys(toHostSettingsChange(call)).length > 0;
}

/** The Needs input card's line: "On build-02: turn the browser on, allow python3". */
export function hostSettingsSummary(call: HostSettingsCall, host: string): string {
  const parts: string[] = [];
  if (call.browser) parts.push(`turn the browser for bots ${call.browser}`);
  if (call.computer) parts.push(`turn the screen for bots ${call.computer}`);
  if (call.exec_mode) parts.push(`set commands to ${call.exec_mode}`);
  if (call.exec_allow?.length) parts.push(`allow ${cut(call.exec_allow.join(', '), 200)}`);
  return `On ${host}: ${parts.join(', ')}`;
}

/** What a `set_host_settings` call came to, in words the model reads. */
export function describeHostSettings(outcome: HostSettingsOutcome, host: string): string {
  switch (outcome.kind) {
    case 'set': {
      const { settings } = outcome;
      const allow = settings.execAllow.length > 0 ? ` (${settings.execAllow.join(', ')})` : '';
      return promptText('sessions/tools-host-settings.set', {
        host,
        browser: settings.browser,
        computer: settings.computer,
        exec: `${settings.execMode}${settings.execMode === 'allowlist' ? allow : ''}`,
      });
    }
    case 'host_offline':
      return promptText('sessions/tools-host-settings.host-offline', { host });
    case 'not_supported':
      return promptText('sessions/tools-host-settings.runner-too-old', { host });
    case 'timed_out':
      return promptText('sessions/tools-host-settings.timed-out', { host });
    case 'failed':
      return promptText('sessions/tools-host-settings.refused', {
        host,
        code: outcome.code,
        detail: outcome.detail ?? 'no reason given',
      });
  }
}
