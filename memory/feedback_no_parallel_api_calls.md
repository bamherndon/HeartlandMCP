---
name: Avoid parallel Heartland API calls
description: Do not fan out multiple simultaneous POST/GET calls to Heartland — it causes throttling errors
type: feedback
---

Avoid making parallel calls to the Heartland Retail API. Use sequential calls (e.g. `for` loops) instead of `Promise.all` when hitting the API multiple times.

**Why:** Heartland throttles requests. This was discovered when `create_inventory_adjustment` was POSTing adjustment lines in parallel via `Promise.all` — lines were failing due to rate limiting. Switching to sequential fixed it.

**How to apply:** Any time a tool needs to make multiple API calls in a loop (e.g. adding lines, fetching per-item data), use sequential `for` loops rather than `Promise.all`. Reserve `Promise.all` only for truly independent one-off lookups where throttling is unlikely.
