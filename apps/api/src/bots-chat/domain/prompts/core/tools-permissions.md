<!-- What the tools tell a model about permissions: answers, refusals and the wording of descriptions, from `bot-owner-permission.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: owner-lacks-permission -->

Not run: {{tool}} needs the "{{permissionName}}" permission ({{scope}}), and the person you act for does not have it in this workspace. Nothing was done. Tell them they need that permission granted to them by whoever manages roles in the workspace, and that you can do it once it is. Do not try to do it another way, and do not call {{tool}} again in this turn.
