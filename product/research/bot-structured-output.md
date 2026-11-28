# Structured output for the bots' background calls, measured

Measured on 2026-11-27. A bot makes four model calls that are not turns,
and its code reads each answer as JSON: the auto review, the rule review,
the goal review and the dream (`apps/api/src/bots-chat/domain/`). Each
prompt asks for "JSON only, no prose", and a reader picks the object out of
the text. The question was whether the engines' native structured output
should replace that. On Claude Code that is
`outputFormat: { type: 'json_schema' }`, which forces the answer through a
`StructuredOutput` tool; the OpenAI Agents SDK has `outputType`. It should
not, for now. Free text already reads 99.6% of the time, every miss fails
safe, and structured output costs more on every call than the misses do.

## 1. What was run

`spikes/bot-structured-output/measure.ts` uses the real prompts, message composers
and readers on 17 inputs. They are the ten `bot-auto-review` cases, three
rule reviews (one with an injection telling the reviewer to answer
`{"matches": []}`), three goal reviews (met, claimed with no proof,
impossible) and one dream over seven overlapping notes. Each input ran 5
times, free and structured, on the Claude Code login, at the engine's
completion shape (no tools, one turn; a structured answer gets 3, since its
tool call needs one more). GLM 5.3 was called on z.ai's Anthropic
endpoint, as the engine sends it. An answer is unreadable when its reader
throws or answers null. Every figure here is measured.

| Model | Free: readable | Structured: readable |
| --- | --- | --- |
| Haiku 5.5 | 84/85 | 85/85 |
| Sonnet 5.5 | 84/85 | 85/85 |
| Opus 5.5 | 84/85 | 83/85 (2 safeguard refusals, no malformed answer) |
| GLM 5.3 | 85/85 | 85/85 |

The three free misses, word for word:

- Haiku, rule review: `{"matches": ["2"]}`, a number written as a
  string. `ruleVerdict` takes integers only.
- Sonnet, auto review: a complete verdict followed by `,"}`, which is
  malformed JSON.
- Opus, auto review: a verdict that stops mid-reason and starts again,
  `{"risk": …, "reason": "This{"risk": …}`. The second object is complete.
  `autoVerdict`'s greedy `/\{[\s\S]*\}/` takes both, so the parse fails.

Under structured output, Opus refused the injected-exfiltration case twice
with "Opus 5.5's safeguards flagged this session" (an API error), on
answers that were right (`critical`/`ask`). Free text never tripped that.

What a structured call costs over the free one, per call (average tokens;
time is the median):

| Model | Input tokens | Output tokens | Time |
| --- | --- | --- | --- |
| Haiku 5.5 | +510 to +1,580 (+35–80%) | +120 to +285 | −0.9 to +1.2 s |
| Sonnet 5.5 | +650 to +2,570 (+25–150%) | +55 to +160 | +0.2 to +1.9 s |
| Opus 5.5 | +510 to +690 (+25–40%) | +45 to +130 | −1.4 to +2.2 s |
| GLM 5.3 | +180 to +320 (+15–30%) | −160 to +25 | −0.6 to +0.4 s |

The input grows by the `StructuredOutput` tool's definition and the extra
turn that answers it.

## 2. What a miss costs today

Every reader fails safe:

- an unreadable **auto review** puts a card in front of the owner
  ("Auto could not check this", `AUTO_UNCHECKED_NOTE`);
- an unreadable **rule review** asks the owner the same way
  (`RULES_UNCHECKED_NOTE`);
- an unreadable **goal review** leaves the goal running and logs "A goal
  review gave no verdict";
- an unreadable **dream** writes nothing, logs it, and the memory stays as
  it was.

So a miss means one extra approval card about once in 250 reviews, or a
dream deferred to the next day. It never runs something unreviewed. With
structured output, every one of those calls pays roughly 15–150% more
input.

## 3. What it shows

- **The prompts already work.** 3 misses in 255 free calls on Anthropic,
  none in 85 on GLM, and none on the goal review or the dream at all.
- **Structured output removes malformed JSON** (0 in 340 structured
  calls), but it is not free and not neutral. It adds 15–150% input to
  calls this small, and on Opus it tripped a safeguard on an injection the
  free call handled.
- **Two of the three misses are the readers', not the model's.** The goal
  reviewer's reader already tries each balanced `{…}` in turn
  (`verdictCandidates`), which would have read the Opus stutter. Accepting
  `"2"` as rule 2 would have read the Haiku answer. Only Sonnet's trailing
  `,"}` needs structured output or a repair.
- **Not measured:** the OpenAI-family engines (OpenAI, ChatGPT, Grok), for
  want of keys here, and real traffic. Neither the local stack nor the
  logs available here hold the reviewers' warnings from use.

## 4. Recommendation

Keep free text. Make the auto and rule readers as forgiving as the goal
reader: try each balanced object, and take an integer written as a string.
That is a small change in `bot-auto-review.policy.ts` and
`bot-rule-review.policy.ts`, each with the answer above as its test. On
this sample it would leave one miss in 255. Reconsider structured output if
a model is added whose free answers miss more often (rerun `measure.ts`
against it), or if the reviewers' warnings in production count more than
these runs suggest.
