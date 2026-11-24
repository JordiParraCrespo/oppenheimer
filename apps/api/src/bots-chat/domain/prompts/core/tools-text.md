<!-- What the tools tell a model about tool text: answers, refusals and the wording of descriptions, from `bot-tool-text.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: runner-too-old-advice -->

update_host_runner updates it; then try again

<!-- fragment: cut-from-the-middle -->

{{head}}
… {{elided}} characters cut from the middle. Ask for less (a filter, a smaller limit) to see them.
{{tail}}
