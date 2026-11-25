import { heyApiSdk, type SlackAccountResponseDto } from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { SlackErrors } from './slack.errors';
import { SlackAccountEntity } from './slack-account.entity';

function toAccount(data: SlackAccountResponseDto): SlackAccountEntity {
  return new SlackAccountEntity(
    data.id,
    data.botId,
    data.status,
    data.statusReason ?? null,
    data.teamId,
    data.teamName,
    data.botUserId,
    data.botName,
    data.tokenHint,
    data.ownerLinked,
    data.linkedAt,
  );
}

/** What creating a bot's Slack app takes: its events address, and Slack's "Create an app" with the manifest in. */
export interface SlackAppSetup {
  eventsUrl: string;
  createUrl: string;
  manifest: string;
}

/** The code that records the reader as the app's owner, and the link to the app's DM. */
export interface SlackOwnerLink {
  message: string;
  url: string;
  expiresAt: string;
}

/**
 * The reader's bots' own Slack apps: connected by pasting the bot token and
 * signing secret of an app made from the bot's manifest, linked to the
 * reader's Slack user by a one-time code, and disconnected. The token and
 * secret are sent once and never read back.
 */
@injectable()
export class SlackRepository {
  findAccounts(): Promise<SlackAccountEntity[]> {
    return callApi(SlackErrors.FETCH_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findSlackAccounts());
      return data.map(toAccount);
    });
  }

  findSetup(botId: string): Promise<SlackAppSetup> {
    return callApi(SlackErrors.FETCH_FAILED, async (api) =>
      api.body(heyApiSdk.findSlackAppSetup({ path: { botId } })),
    );
  }

  /** Connects a bot's app, or hands the bot's app new credentials. */
  connect(botId: string, botToken: string, signingSecret: string): Promise<SlackAccountEntity> {
    return callApi(SlackErrors.CONNECT_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.connectSlack({ body: { botId, botToken, signingSecret } }),
      );
      return toAccount(data);
    });
  }

  /** A one-time code: sent to the app in its DM within ten minutes, it records the sender as the owner. */
  openOwnerLink(id: string): Promise<SlackOwnerLink> {
    return callApi(SlackErrors.OWNER_LINK_FAILED, async (api) =>
      api.body(heyApiSdk.openSlackOwnerLink({ path: { id } })),
    );
  }

  disconnect(id: string): Promise<void> {
    return callApi(SlackErrors.DISCONNECT_FAILED, async (api) => {
      await api.result(heyApiSdk.removeSlackAccount({ path: { id } }));
    });
  }
}
