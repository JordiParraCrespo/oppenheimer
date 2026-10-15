export const BOT_REPOSITORY = Symbol('BOT_REPOSITORY');
export const BOT_GROUP_REPOSITORY = Symbol('BOT_GROUP_REPOSITORY');
export const BOT_DOCUMENT_REPOSITORY = Symbol('BOT_DOCUMENT_REPOSITORY');
export const BOT_MEMORY_FACT_REPOSITORY = Symbol('BOT_MEMORY_FACT_REPOSITORY');
export const MODEL_PROVIDER_CREDENTIAL_REPOSITORY = Symbol('MODEL_PROVIDER_CREDENTIAL_REPOSITORY');
export const PROVIDER_KEY_SEALER = Symbol('PROVIDER_KEY_SEALER');
/** The bot an `/bots/:id` route acts on, through the caller's scope (`BotLookupPort`). */
export const BOT_LOOKUP = Symbol('BOT_LOOKUP');
/** Signing in to ChatGPT and refreshing what it hands back (`ChatgptAuthPort`). */
export const CHATGPT_AUTH = Symbol('CHATGPT_AUTH');
/** A ChatGPT credential's live access token, refreshed when it is about to lapse (`ChatgptCredentialResolver`). */
export const CHATGPT_CREDENTIALS = Symbol('CHATGPT_CREDENTIALS');
