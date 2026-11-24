export const SLACK_ACCOUNT_REPOSITORY = Symbol('SLACK_ACCOUNT_REPOSITORY');
/** Seals a Slack app's bot token and signing secret under `SLACK_TOKEN_KEY` (`SlackSealerPort`). */
export const SLACK_SEALER = Symbol('SLACK_SEALER');
/** Slack's Web API (`SlackWebApiPort`). */
export const SLACK_WEB_API = Symbol('SLACK_WEB_API');
