<!-- The notes a turn's history carries where an image was: one the bot showed, or ones a message came with. Only a turn's own images are sent to the model, so a later turn reads these lines instead. -->

<!-- fragment: shown -->

[Oppenheimer: here you showed the person {{namesCount}} with show_image: {{listed}}.]

<!-- fragment: came-with -->
<!-- On a turn offered view_image. Before it, the note said to ask the person to send the image again, and a bot asked about an image sent a moment earlier did just that (2026-11-28). -->

[Oppenheimer: this message came with {{what}}{{ids}}. Only a turn's own images are sent, so you do not have {{them}} in front of you now; to look at {{them}} again, call view_image with the image id, rather than asking the person to send {{them}} again.]

<!-- fragment: came-with-unviewable -->
<!-- On a turn not offered view_image: a token whose scopes do not cover it, or a model that reads no images. -->

[Oppenheimer: this message came with {{what}}{{ids}}. Only a turn's own images are sent, so you cannot see {{them}} now; if you need to look at {{them}} again, ask the person to send {{them}} again.]

<!-- fragment: attached -->

[Oppenheimer: the images with this message{{ids}}; to attach one to mail, give its id as chat_image.]

<!-- fragment: slack-unread -->

[Oppenheimer: the owner shared {{what}} in Slack with this message that you cannot see: {{why}}.]
