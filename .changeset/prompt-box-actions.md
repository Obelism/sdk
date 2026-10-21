---
'@obelism/content': minor
---

`mountPromptBox` takes `actions`, an element of your page shown in the box (next to the closed box, and in the open box's footer, through a `<slot>` so your CSS styles it), and `signOut: false` to leave Sign out out. Content's canvas mounts the box with its zoom and screen controls this way. Dragging the box also leaves `<select>`s alone. A new label, `scopeNoPage`, is the scope chip's when there is no page to act on (by default the same as `scopeEntry`).
