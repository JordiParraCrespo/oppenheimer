<!-- What the tools tell a model about skills: answers, refusals and the wording of descriptions, from `bot-skill-learning.policy.ts`, `bot-skill.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: nudge -->

<{{skillNudgeTag}}>From Oppenheimer, not from the tool: you have made {{skillNudgeAfterSteps}} tool calls in this turn without a skill. If this is work you will be asked to do again, save how you did it with save_skill before you answer, and say you did; skip it for a one-off.</{{skillNudgeTag}}>

<!-- fragment: fix-your-own -->

You wrote this skill last. If a step turns out wrong or out of date while you follow it, fix it with patch_skill once the task is done, and say so in your answer.

<!-- fragment: theirs-do-not-change -->

The person wrote this skill last: it is their words. If a step turns out wrong or out of date, do not change it; say in your answer what you would change, and change it only if they ask.

<!-- fragment: patch-text-absent -->

Not changed: old_text is not in skill "{{name}}". Read it with use_skill and copy the passage exactly, whitespace included.

<!-- fragment: patch-text-ambiguous -->

Not changed: old_text occurs more than once in skill "{{name}}". Include more of the text around it so it matches one place.

<!-- fragment: patch-would-be-empty -->

Not changed: skill "{{name}}" would be empty. Delete it with delete_skill instead, only if the person asks.

<!-- fragment: patch-too-long -->

Not changed: skill "{{name}}" would be over {{skillBodyMax}} characters. Make the change shorter.

<!-- fragment: name-is-oppenheimers -->

Not saved: a skill cannot be named "{{name}}": Oppenheimer uses that name. Pick another name.

<!-- fragment: skill-is-oppenheimers -->

Not changed: "{{name}}" is Oppenheimer's own (a skill every bot has, or a built-in command), and Oppenheimer uses that name; it cannot be changed. Propose the change in your answer instead, or save your own version under another name.

<!-- fragment: skill-is-theirs -->

Not {{action}}: the person wrote skill "{{name}}" last, and did not ask you to change it. Propose the change in your answer instead; they can make it in Settings → Skills or ask you to.

<!-- fragment: used -->

Skill "{{name}}": {{description}} Follow it for this request.

<!-- fragment: skill-name-skills-name-skills -->

The skill's name, as the skills list or /<name> shows it, e.g. "release-notes".

<!-- fragment: use-skill -->

Reads one of your skills in full, by name, so you can follow it. Use it before starting a request that one of your skills (listed under "Your skills") covers, then follow its steps. A skill only the person may run (by typing /<name>) is not yours to use unasked.

<!-- fragment: use-skill-read-skill-only -->

Not read: "{{name}}" is a skill only the person runs, by typing /{{name}}. Tell them it fits, if it does.

<!-- fragment: save-skill -->

Saves a skill: a reusable way of doing one task, under a short name the person can run as /<name>. Use it when the person asks you to save how you did something ("save that as a skill called…"), or on your own after a task that took real work (several tool calls, or a dead end you worked around) and is likely to come up again, which the person saying they do it regularly is reason enough for: never for a one-off or a lookup of a call or two, and never with a secret or anyone's personal data in it (a key, token or password, bank or card details, a mail address, phone number or messages: leave them out and say where the person keeps them); at most one new skill a turn, and say in your answer that you saved it, by name. A skill of yours with that name is replaced: one the person wrote last only when they asked (set asked_by_person), and to fix one step use patch_skill rather than resending the whole body. The names of the skills Oppenheimer gives every bot are taken. The body says when it applies, what it needs, the steps, how to check the result and what to report, and what needs the person's OK. Name 1 to {{skillNameMax}} of a-z, 0-9 and -; description at most {{skillDescriptionMax}}; body at most {{skillBodyMax}}; at most {{skillsMax}} skills. The person sees and edits it in Settings → Skills.

<!-- fragment: skill-name-one-sentence-what -->

One sentence on what it does and when to use it.

<!-- fragment: save-skill-body -->

The skill, in Markdown: when, inputs, steps, checks, what to report.

<!-- fragment: save-skill-user-invocable -->

Whether the person may run it as /<name>. Default true.

<!-- fragment: save-skill-model-invocable -->

Whether you may use it unasked when a request fits. Default true; false for a skill only the person should start.

<!-- fragment: save-skill-asked-by-person -->

True only when the person asked in this conversation to change this skill. Needed to replace a skill they wrote.

<!-- fragment: save-skill-use-when-request -->

you use it when a request fits

<!-- fragment: save-skill-skill-person-can -->

{{existing}} skill "{{name}}" ({{runs}}). The person can see and edit it in Settings → Skills.

<!-- fragment: patch-skill -->

Fixes part of one of your skills: replaces one exact passage of its body with new text, so a step that turned out wrong or out of date is fixed without resending the whole skill. Use it once the task is done, when a skill you followed was wrong or stale, and say in your answer what you fixed. old_text must occur exactly once in the body, copied as use_skill showed it; the result is at most {{skillBodyMax}} characters. A skill you saved last you may fix unasked; one the person wrote last only when they asked for the change in this conversation (set asked_by_person), otherwise propose the change in your answer. The skills Oppenheimer gives every bot cannot be changed.

<!-- fragment: patch-skill-old-text -->

The passage to replace, exactly as it is in the skill, enough to be unique.

<!-- fragment: patch-skill-new-text -->

What replaces it; empty removes the passage.

<!-- fragment: patch-skill-asked-by-person -->

True only when the person asked for this change in this conversation. Needed to change a skill they wrote.

<!-- fragment: patch-skill-fixed-skill-say -->

Fixed skill "{{name}}". Say in your answer what you changed. The person can see and edit it in Settings → Skills.

<!-- fragment: delete-skill -->

Deletes one of your skills, by name, and its /<name> command with it. It cannot be undone; only when the person asks.

<!-- fragment: delete-skill-deleted-skill-have -->

Deleted skill "{{name}}"; you have {{leftCount}} left.
