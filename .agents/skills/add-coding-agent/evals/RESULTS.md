# Eval results

How to run eval 1 (`evals.json`): two fresh agents get its prompt on the same
`main`, one told to follow this skill, one told not to read it. Strip from
each plan anything that names how it was made, label them A and B, and give
both to a third agent with the expectations as a 0–2 rubric, checking claims
against the repo and the CLI. Fold what it finds into `references/lessons.md`
and `SKILL.md`.

## 2026-11-23, Qwen Code 0.28.4, skill at 064902583

| Run | Score (of 32) |
| --- | --- |
| With the skill | 31 |
| Without | 24 |

The skill's run won on resume (`--continue` where `--resume <id>` exits
before the first message), the updater (`qwen update` on an npm install is a
no-op), typing into it (Up recalls a prompt; `input.clear`; the three
senders), the chat view and the live proof. The run without it won on the
manifest, whose strings it watched in tmux through a fake OpenAI-compatible
server, and on a task starting with `-`, which Qwen reads as a flag. Those
two, the existing `conversation.reopen` that the skill's run overlooked, and
the login host the person is shown went into the skill afterwards.
