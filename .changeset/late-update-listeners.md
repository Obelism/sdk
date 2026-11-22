---
'@obelism/content': patch
---

The bridge calls an `update` listener added after the editor's update right away with each entry's latest one, so `useLiveEntry` in a component that mounts late (streamed in after hydration) shows the live entry, and a canvas variant frame shows its variant.
