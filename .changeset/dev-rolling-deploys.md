---
"@oppenheimer/web": patch
---

The web image's nginx looks the API up by name every few seconds instead of
once at start, and retries a request on another API container when one
refuses it, so it follows an API replaced without downtime.
`NGINX_RESOLVER` (Docker's embedded DNS by default) names the resolver.
