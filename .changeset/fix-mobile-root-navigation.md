---
"@oppenheimer/mobile": patch
---

Mount the root navigator before the authentication guards, so the app starts without Expo Router throwing an early-navigation error, and refresh the login screen onto the shared auth layout.
