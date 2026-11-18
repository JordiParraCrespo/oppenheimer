<!-- What the tools tell a model about peer messages: answers, refusals and the wording of descriptions, from `bot-chain.policy.ts`, `bot-peer-message.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: check-bot-chain-cannot-message-yourself -->

You cannot message yourself. Do the work in this turn instead.

<!-- fragment: check-bot-chain-request-has-already -->

This request has already passed through {{chainDepth}} bots, the most one request of the person may reach ({{maxDepth}} bots deep). Do what you can yourself and tell the person what is left.

<!-- fragment: check-bot-chain-bots-have-already -->

Bots have already sent each other {{asks}} messages because of this request, the most one request of the person may cause ({{turnBudget}}). Finish with what you have and tell the person what is left.

<!-- fragment: check-bot-chain-bot-already-working -->

That bot is already working on this request further up the chain, so messaging it would go round in a circle. Answer with what you have; if you were asked, your answer goes back on its own.

<!-- fragment: peer-refusals-not-running -->

This turn is no longer running, so it can send nothing.

<!-- fragment: peer-refusals-no-account -->

The person this request came from no longer has an account.

<!-- fragment: peer-refusals-chain-gone -->

The request this belongs to was cleared from the chat it started in, so no more bots are messaged for it.

<!-- fragment: peer-refusals-no-key -->

{{name}} runs on {{provider}}, and the workspace has no {{provider}} key, so it could not answer. Tell the person; they can add the key in Settings → Model providers.

<!-- fragment: secret-refusal -->

Not sent: the message contains what looks like {{kind}}. Credentials never travel between bots. Remove it and send again; if the other bot needs access, the person connects it in Settings.

<!-- fragment: peer-answer-of-content-stopped-before-answered -->

It was stopped before it answered.

<!-- fragment: peer-answer-of-content-ended-without-writing -->

It ended without writing an answer.

<!-- fragment: resolve-provider-refusal-workspace-has-model -->

The workspace has no model provider key, so no new bot could answer. Ask the person to add one in Settings → Model providers.

<!-- fragment: resolve-provider-refusal-workspace-has-key -->

The workspace has no {{label}} key, so a bot on {{label}} could not answer. Providers it can use: {{usable}}. Pick one of those, or ask the person to add a {{label}} key in Settings → Model providers.

<!-- fragment: resolve-model-refusal -->

{{label}} has no model "{{model}}". Its models: {{offered}}. Leave model out for {{engineLabel}}.

<!-- fragment: resolve-effort-refusal -->

{{engineLabel}} does not take effort "{{effort}}". {{levelsCount}} Leave effort out for its default.

<!-- fragment: resolve-permission-refusal -->

You run under {{ceiling}}, and a bot you create can have no looser permissions than yours. Leave permission out (it gets {{ceiling}}); the person can raise it in the new bot's settings.

<!-- fragment: resolve-group-refusal -->

The workspace has no bot group "{{group}}". {{names}} Leave group out to create it ungrouped; you cannot create groups.

<!-- fragment: created-answer -->

Created bot {{id}} "{{name}}"{{group}}.
- runs on: {{engineLabel}} (provider {{provider}}, model {{model}})
- permission: {{permission}} ({{permission2}})
It is the person's bot, marked as created by you. They can open it from the sidebar, under Employees.
