---
'@obelism/numbers-sdk': minor
---

Batches the events of one task into one request, and adds `flush()`.

- `track()`, `pageView()`, `formSubmit()` and `expose()` no longer post on their own: they queue, and a microtask later the queue goes out as one `POST /api/log` — an array of up to ten events (and at most 4 KB of JSON). A checkout that tracks its items, or a page that reports its impressions, is one request instead of many; nothing waits on a timer, so a page view is still sent in the same tick it is made.
- `numbers.flush()` sends what is queued right away, e.g. on a route change before the app tears the client down.
- `track()` still returns the request's promise, resolving with the batch's response.
- The size warning is unchanged, and a 429 pauses every event in the batch.

Needs numbers' `/api/log` to take an array of events; a single event is still sent as one object, so a client against an older numbers keeps working as long as it only makes one event per task.
