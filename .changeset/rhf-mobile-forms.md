---
"@oppenheimer/mobile": patch
---

Adopt React Hook Form for the auth screens, validated against the shared Zod
schemas. They previously held one `useState` per field and reported the first
Zod failure in an `Alert`; errors now surface inline, next to the input that
caused them.
