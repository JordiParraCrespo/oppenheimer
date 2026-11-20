---
"@oppenheimer/api": minor
---

Bots answer the groups and people a WhatsApp number allows. In an allowed group, a message that mentions the number or replies to one of its messages wakes the chat's bot; in an allowed person's chat, any message does. The chat's bot is the one chosen for it, else the number's default, and no one answers when the default is "None (doesn't answer)" and the chat has no bot of its own. Such a turn is a contact's turn (`bot_turn.contact`): no tools, none of the owner's memory, skills or hosts, and what the contact wrote fenced as untrusted, with at most 20 turns an hour per chat. Needs the runner that reports mentions and quoted senders.
