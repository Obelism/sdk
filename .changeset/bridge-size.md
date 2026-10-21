---
'@obelism/content': minor
---

For Content's canvas, which shows whole pages side by side:

- The bridge tells the editor the page's height, with `ready` and as a `size` message whenever it changes.
- On a `viewport` message, it rewrites `vh`, `svh`, `lvh` and `dvh` sizes in the page's stylesheets as pixels of the screen height the frame stands for. Without that, a `100vh` section would grow with a frame that is as tall as the page.
