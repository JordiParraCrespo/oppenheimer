<!-- What the bots tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-bots-tools.factory.ts`, `bot-update.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: message-bot -->

Sends another of the person's bots a message without waiting for an answer: a heads-up, a hand-off, or something it should act on in its own job. It reads it as its next turn after the person's own messages, marked as from you; nothing it writes comes back to you. Use ask_bot instead when you need its answer, and list_bots for its id. It does not see this chat, so say everything it needs. At most {{peerMessagesPerTurn}} messages to other bots a turn, and never a token, key or password.

<!-- fragment: ask-bot -->

Asks another of the person's bots a question, or gives it a task, and gets its answer back: when it has finished, its answer arrives in this chat as a new message from Oppenheimer and you carry on from there. You do not wait for it in this turn: after asking, tell the person in a sentence what you asked and of whom, and end your turn unless other work is left. It does not see this chat, so say everything it needs. Use list_bots for its id. At most {{peerMessagesPerTurn}} messages to other bots a turn, and never a token, key or password.

<!-- fragment: send-have-already-sent -->

You have already sent {{peerMessagesPerTurn}} messages to other bots this turn, the most one turn may send. Finish with what you have.

<!-- fragment: send-asked-answer-will -->

Asked {{botName}} ({{botId}}). Its answer will arrive in this chat as a new message once it has finished; do not ask again or wait for it now.

<!-- fragment: send-sent-will-read -->

Sent to {{botName}} ({{botId}}). It will read it after the person's own messages to it; it will not reply to you.

<!-- fragment: create-bot -->

Creates a new bot for the person, marked as created by you: its name, what it is for, its soul (persona and tone) and instructions (its job and rules), and what runs it. The provider and model default to yours; only a provider the workspace has a key for is accepted. Its permission defaults to Approve for me and is never looser than yours. It can go in an existing group (by name or id from the sidebar); you cannot create groups. Use list_bots first so you do not make a second bot for the same job.

<!-- fragment: bot-description -->

What it is for, in a sentence.

<!-- fragment: create-bot-soul -->

Its SOUL.md, in Markdown: who it is and how it speaks. A template that says its name when omitted.

<!-- fragment: create-bot-instructions -->

Its INSTRUCTIONS.md, in Markdown: its job and rules. Empty when omitted.

<!-- fragment: create-bot-provider -->

Who answers it; yours when omitted.

<!-- fragment: create-bot-model -->

A model id or label the provider offers; yours on the same provider when omitted, else the provider's default (also null).

<!-- fragment: create-bot-effort -->

Only for a model that takes one; null is Auto: medium on a model whose own default is lower, else the model's own default.

<!-- fragment: create-bot-permission -->

ask (Ask for approval: what reaches outside asks), auto (Approve for me: a reviewer lets safe calls run, the rest asks) or full (Full access: nothing asks); never looser than yours. auto when omitted, or yours when stricter.

<!-- fragment: create-bot-group -->

An existing bot group, by name or id; ungrouped when omitted.

<!-- fragment: update-bot -->

Changes the settings of one or more of the person's bots (you included) in one call: what runs them (provider, model, effort and advisor), their permission, their group, their name, description and avatar colour, and whether they save what they learn without asking. Give every bot the change applies to in bot_ids (from list_bots), at most {{updateMax}}; a field left out stays as it is. A model is an id or label of the bot's provider (the one named here, else each bot's own); a provider needs a workspace key. Permission is never looser than yours; a rename goes to one bot at a time; you cannot create groups. It does not edit a bot's soul or instructions.

<!-- fragment: update-bot-bot-ids -->

The bots to change, from list_bots.

<!-- fragment: update-bot-avatar-color -->

The colour its face is drawn in.

<!-- fragment: update-bot-provider -->

Who answers them; switching provider without a model runs that provider's default.

<!-- fragment: update-bot-model -->

A model id or label the provider offers; null is the provider's default.

<!-- fragment: update-bot-advisor-model -->

A stronger model the bots' turns may consult mid-turn for a plan or a second look, billed as that model: an id or label the bots' model takes as its advisor (Anthropic models only; get_self or get_bot says the current one). null turns it off.

<!-- fragment: update-bot-permission -->

ask (Ask for approval: what reaches outside asks), auto (Approve for me: a reviewer lets safe calls run, the rest asks) or full (Full access: nothing asks); never looser than yours.

<!-- fragment: update-bot-group -->

An existing bot group, by name or id; null takes them out of their group.

<!-- fragment: update-bot-learn-automatically -->

Whether what they decide to remember is saved without asking.

<!-- fragment: update-plan-longer-one-workspaces -->

You are no longer one of the workspace’s bots.

<!-- fragment: update-plan-workspace-has-bot -->

The workspace has no bot {{unknown}}. Use list_bots for their ids.

<!-- fragment: list-bots -->

Lists the workspace's bots (you included, marked) with what each is for, its sidebar group, its provider and model, and its home host. Use get_bot for one bot's details.

<!-- fragment: get-bot -->

Reads one bot of the workspace: its name, what it is for, its provider and model, its home host and when its chat was last used. It does not read the bot's soul, instructions, memory or chat.

<!-- fragment: get-bot-bot-runs-provider -->

Bot {{id}} "{{name}}"{{id2}}
- for: {{description}}
- runs on: {{engineLabel}} (provider {{provider}}, model {{model}}, effort {{effort}})
- advisor: {{advisor}}
- permission: {{permission}} ({{permission2}})
- group: {{groupLabel}}
- home host: {{homeHostId}}
- last message: {{formatToolTime}}

<!-- fragment: peer-message-bot-id -->

The other bot, from list_bots. Not yourself.

<!-- fragment: peer-message-message -->

What you are telling or asking it, complete on its own: it does not see this chat.

<!-- fragment: plan-bot-update-refusal-name-least-one -->

Name at least one thing to change: name, description, avatar_color, provider, model, effort, permission, group or learn_automatically.

<!-- fragment: plan-bot-update-refusal-name-goes-one -->

A name goes to one bot at a time: call update_bot once per bot to rename.

<!-- fragment: update-looser-than-yours -->

You run under {{ceiling}}, and you cannot give a bot looser permissions than yours. Ask the person to raise it in that bot's settings.

<!-- fragment: engine-update-for-refusal -->

For "{{name}}": {{engineLabel}} does not take effort "{{effort}}". {{levelsCount}} Leave effort out for Auto.

<!-- fragment: engine-update-for-advisor-refusal -->

For "{{name}}": {{engineLabel}} does not take "{{advisor}}" as its advisor. {{advisorsCount}} Name one it takes, or null for none.

<!-- fragment: bots-updated-answer -->

- {{id}} "{{name}}": runs on {{engineLabel}} (provider {{provider}}, model {{model}}, effort {{effort}}, advisor {{advisor}}); permission {{permission}}
