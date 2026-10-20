---
'@obelism/events-sdk': minor
'@obelism/numbers-sdk': minor
---

New package, `@obelism/events-sdk`: one event bus per page (`getEvents()`, on `window.obelismEvents`) that sites publish to (`emit`, `expose`, `autoTrack`) and trackers subscribe to, with the events from before they subscribed replayed. numbers is its first subscriber: `numbers.connect(events)` sends the bus's events, page views and exposures, and the script tag connects to the page's bus and has it track page views and clicks, so `obelismEvents.emit(…)` reaches numbers. `TrackOptions` fields take `undefined`
