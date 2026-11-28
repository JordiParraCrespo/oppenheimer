# Bot earlier-image eval

Does a bot asked about an image from an earlier message look at it again
(`view_image`) rather than ask the person to send it again?

On 2026-11-28 a bot on GPT-6.2 Sol was sent `image.png` alone and, before
its answer came, asked "Whici is this product?". That second turn was sent
no image (a turn is sent only its own message's images), and the history's
note told it to ask for the image again, so it did. The fix gives it
`view_image`, which loads an earlier image of the conversation by the id
the note carries, and a note that says to use it
(`core/turn-images.came-with`, `core/tools-images`).

## How it works

Each case in `cases.json` is the earlier messages (the person's carrying
images, each read back through the production `withEarlierImages`) and the
person's new one. The runner builds the real system prompt with
`view_image` (its production description and schema) and a few stub tools,
and runs one turn. This transport carries no images, so the stub answers
`view_image` with the production words and a description of the picture.

| Case | The person asks | Right when |
| --- | --- | --- |
| `which-product` | about an image sent alone, before any answer (the incident) | calls `view_image` with its id and does not ask for it again |
| `detail-after-answer` | for a detail the earlier answer did not give | the same |
| `nothing-to-look-at` | for something the chat already answers | does not call `view_image` |

A case passes on a majority of its runs.

```bash
pnpm eval:bot-earlier-image                       # every case, 3 runs each
pnpm eval:bot-earlier-image --case which-product --runs 1
```

`BOT_EARLIER_IMAGE_EVAL_MODEL` picks the model (default `claude-sonnet-5-5`).

## Results

| Date | Model | Prompt | Runs right |
| --- | --- | --- | --- |
| 2026-11-28 | claude-sonnet-5-5 | before (no `view_image`, the old note) | 2/6: both follow-ups asked for the image again |
| 2026-11-28 | claude-sonnet-5-5 | the old note, `view_image` offered | 5/6: one look it did not need |
| 2026-11-28 | claude-sonnet-5-5 | after | 9/9 |

The report came from a bot on GPT-6.2 Sol, which this eval cannot run
without an OpenAI transport.
