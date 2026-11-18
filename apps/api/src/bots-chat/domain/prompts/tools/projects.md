<!-- What the tools tell a model about projects: answers, refusals and the wording of descriptions, from `bot-project.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: namesake-refusal -->

A project named "{{name}}" already exists: {{listed}}. Ask the person whether they mean that one; only if they want a second project with the same name, call again with allow_same_name true.
