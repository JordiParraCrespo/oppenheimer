<!-- What the tools tell a model about forms (`ask_form`): its description, the words of its fields, and its answers, from `bot-form.policy.ts` and `bot-form-tools.factory.ts`. -->

<!-- fragment: ask-form -->

Asks the person to fill a form on a card in the chat (a title, what it is for, {{fieldsMin}} to {{fieldsMax}} fields) and ends your turn; what they send opens your next one, each value under its field's id. Use it when you need several values from them at once, most of all values they type (a name, an address, a number, a date, a few lines of text): one form instead of a string of questions. For one choice among a few likely answers, use ask_user instead. Do not use it for a yes to an action: the actions that need one ask on their own. Ask only for what you cannot find yourself, mark a field required only when you cannot go on without it, and fill a default when you can guess well. One card waits at a time, a form, questions or an approval.

<!-- fragment: title -->

What the form is for, in a few words ("Release details").

<!-- fragment: description -->

One or two sentences under the title: why you ask, and what you will do with it.

<!-- fragment: submit-label -->

The button's word or two ("Send", "Book it"); "Submit" when left out.

<!-- fragment: fields -->

The fields, in the order the person fills them.

<!-- fragment: field-id -->

What you read the value by: lowercase letters, digits and underscores, starting with a letter ("due_date"), distinct within the form.

<!-- fragment: field-kind -->

What the field takes: text (a line), textarea (a few lines), number, select (one of its options), email, date (YYYY-MM-DD).

<!-- fragment: field-label -->

The field's name as the person reads it ("Due date").

<!-- fragment: field-placeholder -->

An example shown in the empty field ("v2.4.0").

<!-- fragment: field-required -->

True when the form cannot be sent without it.

<!-- fragment: field-default -->

The value the field starts with: words, a number for a number field, one of the options for a select, YYYY-MM-DD for a date.

<!-- fragment: field-min -->

For a number field: the smallest value it takes.

<!-- fragment: field-max -->

For a number field: the largest value it takes.

<!-- fragment: field-options -->

For a select field: the values to pick one of, {{optionsMin}} to {{optionsMax}}. Required for a select, ignored on the other kinds.

<!-- fragment: asked-form -->

Asked: your form ({{fields}}) is now on a card in the chat, waiting for the person to fill it. End your turn now without guessing the values or acting on them; what they send opens your next turn.

<!-- fragment: waiting-for-answer -->

Not asked: an earlier card of yours is still waiting for the person ("{{pendingSummary}}"), and only one can wait at a time. End your turn now and say you are waiting for their answer.

<!-- fragment: form-invalid -->

Not asked: the form does not hold together ({{problem}}). Fix it and call ask_form again.
