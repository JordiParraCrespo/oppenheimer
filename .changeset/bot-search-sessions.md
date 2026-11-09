---
"@oppenheimer/api": minor
"@oppenheimer/shared": patch
---

Bots get `search_sessions`: a full-text search over every session of the workspace, on any host and closed ones included, by the words of its name and its log (tasks and follow-ups, the agent's results, notes, questions and failures), with web-search syntax and `host_id`, `project_id` and `since` filters. Each session shows its best two matches, sessions best first. The agents' transcripts on the hosts are not searched. A migration adds `work_session_event_search_vector` and two GIN indexes (`IDX_work_session_event_search`, `IDX_work_session_name_search`). The `recap` skill searches its topic with it, and the user guide's Bots page says so.
