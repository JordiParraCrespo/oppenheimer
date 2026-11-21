---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/runner': minor
'@oppenheimer/web': minor
'@oppenheimer/design-system-web': minor
'@oppenheimer/translations': minor
---

A WhatsApp number's Settings lists its groups and saved contacts before anyone writes: the runner reports them on connect and when a group is joined or renamed or the contacts change (the new `whatsapp.chats` frame), and the API keeps them per number (`whatsapp_known_chat`, up to 5,000, forgetting a chat not reported for 7 days). A group set to a bot now wakes it on every message with words, not only a mention or a reply, up to 120 turns an hour per group. People lists the owner first, fixed on the default bot; the "Answered by" filter is searchable and caps its height; the tab counts sit on their label's baseline, and `FacetSelect` takes `size="sm"` so a filter row stands at one height.
