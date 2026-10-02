---
"@oppenheimer/backend-email": patch
---

The SMTP driver speaks implicit TLS on port 465 (other ports keep upgrading
with STARTTLS) and sends `auth` only when both `SMTP_USER` and `SMTP_PASS` are
set, so a relay configured with a host alone is no longer asked to log in with
blank credentials.
