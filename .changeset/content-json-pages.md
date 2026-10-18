---
'@obelism/content': minor
---

Editing on the site: the prompt box switches between **Prompt** and **JSON**. JSON shows the page, or the selected block, as the language model sees it, with the unsaved changes, to change by hand or to tweak what a prompt made; applying it is checked like a prompt's answer and undone the same way (Ctrl/Cmd + Enter applies, Enter is a new line). A chip in the box names the page and lists every page of the space, drafts included, with a search, to go to one. The bridge has `view()`, `applyJson()`, `pages()` and `openPage()` for your own UI (the `SitePage` and `ApplyJsonResult` types), and `createSiteEditing` forwards their calls. They need a CMS with the site API's `entries/{id}/view`, `entries/{id}/apply` and `pages` routes.

`ContentTypeDefinition.description` is a `string` (required in the CMS now; `null` from an older one), and `content types` writes content type and field descriptions as JSDoc, so editors show them on hover.
