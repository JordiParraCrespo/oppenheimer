<!-- What opens a turn whose message starts with a slash command: the skill the person ran, a command that names no skill of theirs, or a /goal the console should have run. The person's own words follow each, as they wrote them. -->

<!-- fragment: ran-a-skill -->
<!-- OpenClaw's skill commands, which "route to the model as a normal request": the skill, then their message, whose words after the command are the skill's input. -->

The person ran your skill /{{name}}. Follow it for this request. {{input}}

<!-- fragment: with-input -->

What they wrote after the command is its input.

<!-- fragment: with-no-input -->

They gave it no input: use what the chat already says, or ask for what it needs.

<!-- fragment: not-a-skill -->
<!-- A typo, a deleted skill, or only a path. The bot is told which commands it has, so it can say so rather than guess. -->

The message starts with /{{name}}, which is not one of your skills. {{yours}} If they meant a skill, say so in a sentence and suggest the closest one; if it is not a command (a path, say), read the message as written.

<!-- fragment: skills-they-can-run -->

The skills they can run are {{skills}}.

<!-- fragment: no-skills-to-run -->

You have no skills they can run.

<!-- fragment: goal-command -->
<!-- A `/goal` that shows or clears the goal is the console's to run and the API refuses to send one; this only reads one that came from before that rule, so the bot answers in a line. -->

The person typed a /goal command that shows or clears your goal; Oppenheimer runs those itself. Say in a line what your goal is now, if you have one.
