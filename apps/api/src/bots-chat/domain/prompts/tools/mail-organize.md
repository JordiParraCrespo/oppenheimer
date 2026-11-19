<!-- What the mail organize tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-mail-organize-tools.factory.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: account -->

Which Gmail account: its account id, its address, or its name, as list_gmail_accounts gives them.

<!-- fragment: ids -->

{{what}} ids, as search_mail and read_mail_thread give them; at most {{mailOrganizeMax}}.

<!-- fragment: label-names -->

Labels by name or id, as list_mail_labels gives them.

<!-- fragment: resolved-names -->

Leave out: Oppenheimer fills it in.

<!-- fragment: mark-mail -->

Marks threads or messages of the person's Gmail read or unread, starred or not, important or not. Give only the marks to change. Searching and reading never mark anything; only this does. At most {{mailOrganizeMax}} at once.

<!-- fragment: mark-mail-read -->

true marks read, false unread.

<!-- fragment: mark-mail-starred -->

true stars, false takes the star off.

<!-- fragment: mark-mail-important -->

true marks important, false not important.

<!-- fragment: label-mail -->

Puts labels on threads or messages of the person's Gmail, or takes them off. Name each label as list_mail_labels gives it; create_label makes a new one. To trash mail, use trash_mail. At most {{mailOrganizeMax}} threads or messages at once.

<!-- fragment: label-mail-add -->

Labels to put on, by name or id.

<!-- fragment: label-mail-remove -->

Labels to take off, by name or id.

<!-- fragment: archive-mail -->

Takes threads out of the person's Gmail inbox; they stay in All Mail with their labels, and come back on a reply. At most {{mailOrganizeMax}} threads at once.

<!-- fragment: trash-mail -->

Moves threads of the person's Gmail to Trash, which Gmail empties after 30 days; untrash_mail brings them back until then. Asks the person first, unless they have allowed it for you. Nothing is ever deleted for good. At most {{mailOrganizeMax}} threads at once.

<!-- fragment: untrash-mail -->

Brings threads of the person's Gmail back out of Trash, where they were before. At most {{mailOrganizeMax}} threads at once.

<!-- fragment: create-label -->

Creates a label in the person's Gmail, shown in its label list. Use "Parent/Child" to nest it. label_mail then puts it on mail.

<!-- fragment: label-change -->

No label {{missing}} in this account. list_mail_labels gives them; create_label makes a new one.

<!-- fragment: assert-changes -->

Say what to change: which marks, or which labels to put on or take off.

<!-- fragment: assert-not-reserved -->

Trash, Spam, Drafts and Sent are not labels a bot puts on mail. Use trash_mail to trash it.

<!-- fragment: assert-targets-name-threads-messages -->

Name the threads or messages to change.

<!-- fragment: assert-targets-once-one-call -->

{{count}} at once; one call changes at most {{mailOrganizeMax}}. Split them over several calls.
