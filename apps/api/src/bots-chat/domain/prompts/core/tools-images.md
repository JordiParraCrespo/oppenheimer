<!-- What `view_image` tells a model: its description, and what a call answers. A turn is sent only its own message's images; an earlier one is a note with its id (`core/turn-images.came-with`), and this tool loads it again. The code reads each fragment by id and decides when it is said (`bot-image-tools.factory.ts`). -->

<!-- fragment: view-image -->

Looks again at an image sent earlier in this chat: you see it as a picture in the answer. A turn is shown only its own message's images, so when the person asks about, or you need, an image from an earlier message (its note gives the image id), call this with that id instead of asking them to send it again. Do not call it when the chat already says what you need. Only images of this chat; one id a call, up to {{viewsPerTurn}} a turn.

<!-- fragment: view-image-id -->

The image id, from the note on the earlier message ("image id …").

<!-- fragment: viewed -->

The image "{{name}}" from earlier in this chat, as it was sent.

<!-- fragment: not-found -->

No image {{id}} in this chat. Use an id from a note on an earlier message of this chat.

<!-- fragment: gone -->

The image "{{name}}" could not be read from storage: it may have been deleted, or storage is not answering just now. Say so; if you still need it, try once more later or ask the person to send it again.

<!-- fragment: unreadable -->

The image "{{name}}" cannot be shown: it is not an image type you read, or it is larger than the limit. Say so, and ask the person for it another way if you need it.

<!-- fragment: needs-eyes -->

The model this turn runs on reads no images, so it cannot look at one. Say so.

<!-- fragment: views-spent -->

Not shown: this turn has already looked at {{viewsPerTurn}} earlier images, the most one turn may. Answer from what you have seen.
