---
'@obelism/content': minor
---

Editing on the site: the prompt box switches between **Prompt** and **Form**, where the JSON editor was. Form shows the CMS's own entry form for the page, or the entry around the selected block, in the box (an iframe), edited live: changes land in the unsaved changes, show on the page and undo a burst of edits at a time, and prompts, undo and a new selection show in the form. The bridge has `openForm(container, { onReady, onError })` for your own UI (the `FormOptions` and `FormHandle` types), and `createSiteEditing` forwards `/cms/api/form`. It needs a CMS with the site API's `form` route (`/api/site/v1/form`) and the `/site/form` page. `bridge.view()` and `bridge.applyJson()` stay, as the raw alternative; the JSON labels left `PromptLabels` (now `form`, `formTitle` and `formLoading`).
