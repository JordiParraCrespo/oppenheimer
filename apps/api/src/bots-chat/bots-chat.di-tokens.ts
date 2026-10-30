export const BOT_TURN_REPOSITORY = Symbol('BOT_TURN_REPOSITORY');
export const BOT_MESSAGE_REPOSITORY = Symbol('BOT_MESSAGE_REPOSITORY');
export const BOT_APPROVAL_REPOSITORY = Symbol('BOT_APPROVAL_REPOSITORY');
/** The cards of questions a bot puts to its owner (`ask_user`). */
export const BOT_QUESTION_REPOSITORY = Symbol('BOT_QUESTION_REPOSITORY');
export const BOT_STREAM = Symbol('BOT_STREAM');
/** The engines a turn runs on (`@oppenheimer/backend-agents`), bound once per process. */
export const BOT_ENGINE = Symbol('BOT_ENGINE');
export const WEB_PAGE = Symbol('WEB_PAGE');
export const OWNER_HOSTS = Symbol('OWNER_HOSTS');
export const BOT_CONVERSATION_SUMMARY_REPOSITORY = Symbol('BOT_CONVERSATION_SUMMARY_REPOSITORY');
/** What is said to a bot, apart from its turns: Clear history's deletes, joined into the turn repository's transaction. */
export const BOT_CONVERSATION_REPOSITORY = Symbol('BOT_CONVERSATION_REPOSITORY');
export const BOT_ATTACHMENT_REPOSITORY = Symbol('BOT_ATTACHMENT_REPOSITORY');
/** A chat image's bytes, in the deployment's storage. */
export const BOT_ATTACHMENT_FILES = Symbol('BOT_ATTACHMENT_FILES');
/** What sessions each bot follows (`27-bot-subscriptions.md`). */
export const BOT_SUBSCRIPTION_REPOSITORY = Symbol('BOT_SUBSCRIPTION_REPOSITORY');
export const BOT_GOAL_REPOSITORY = Symbol('BOT_GOAL_REPOSITORY');
/** A bot's tool settings and standing grants (`25-bots.md` §5). */
export const BOT_TOOL_PERMISSION_REPOSITORY = Symbol('BOT_TOOL_PERMISSION_REPOSITORY');
/** A bot's plain-language permission rules (`25-bots.md` §5). */
export const BOT_PERMISSION_RULE_REPOSITORY = Symbol('BOT_PERMISSION_RULE_REPOSITORY');
