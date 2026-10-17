---
'@obelism/content': minor
---

The bridge shows click rates on the page in the visual editor: a label on every block with clicks ("24% clicked"), from the editor's new `stats` message, turned on and off by its "Show click rates on the page" switch. Clicking a label selects the block. The rates and the switch are in the bridge's state as `stats` and `statsVisible`; `mountStatsOverlay` and its types are exported from `@obelism/content/bridge`.
