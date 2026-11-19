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
