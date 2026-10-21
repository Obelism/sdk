---
name: test-a-block
description: Run an A/B test on a block of a Content page with Obelism improve, and read how it does in improve and numbers. Use when the user wants to try another headline, hero, offer or section on a page, compare variants of a block, or asks how a running test or a block is doing.
---

# A/B test a block of a page

A test on a block takes all three products:

- **improve** (`obelism-improve`) holds the test: its options, goal events
  and results.
- **Content** (`obelism-content`) holds what each option shows, in its
  built-in `_improve` block on the page.
- **numbers** (`obelism-numbers`) shows the events coming in and the clicks
  on the page.

Tests in improve and pages in Content belong to the same Space and
environment. Use the same ones throughout.

## 1. The page and the block

1. `listOrganizations`, `listSpaces`, then find the page with `listEntries`
   (`search` by name or path) and `getEntry`.
2. Find the block the user means in the page's blocks field. Ask if it isn't
   clear which one.

## 2. The test in improve

1. `listTests` first: reuse a test with the same purpose rather than making
   a second one.
2. `createTest` with a `name`, a `slug` (kebab-case, e.g. `pricing-hero`)
   and two options (by default `control` and `variation`, 50/50). Leave it a
   draft: don't set `state` to `active` yet.
3. Set its `events`: the `conversion` the user cares about, such as a
   sign-up, a purchase, or a click on the block's button. A click is
   `{ "event": "click", "scope": "<the button's data-numbers-id>" }`. Ask
   what counts as success if the user didn't say.

## 3. The variants in Content

1. `listImproveSources` shows the tests and flags Content can use in this
   environment. The new test should be there.
2. Replace the block in the page's draft with an `_improve` block that holds
   one list of blocks per option slug:

   ```json
   {
   	"_type": "_improve",
   	"kind": "test",
   	"slug": "pricing-hero",
   	"variants": {
   		"control": [{ "_type": "hero", "heading": "Plans for every team" }],
   		"variation": [
   			{ "_type": "hero", "heading": "Start free, upgrade later" }
   		]
   	}
   }
   ```

   `control` keeps the block as it was (without its `_uid`). The other
   options get the changed copy. Only use block types that list allows.

3. `saveEntry` with `baseRevision` = the entry's `draftRevision`. A 409 means
   someone saved in between: read it again.
4. `previewEntry` to check both variants come through.

## 4. Starting it

Starting a test and publishing the page are the user's decision. Tell them
what you prepared and ask before you:

1. `updateTest` with `state: "active"`.
2. `publishEntry` on the page (publishing checks that the test exists in the
   environment and that every variant is one of its options).

The site must render the `_improve` block: it asks improve's SDK for the
visitor's option (`getTestValue(slug)`) and shows that list, falling back to
`control` when it gets `null`. If the site doesn't do that yet, say so; the
`connect-site` skill and the SDK's docs cover it.

For another environment, `syncTests` copies the test there before the page
is promoted.

## 5. How it does

- **improve**: `getTestResults` gives visitors and conversions per option
  and the significance against control. `status` is `pending` until the test
  has exposures. Don't call a winner before it is significant; say how many
  visitors each option has so far.
- **numbers**: `listEvents` shows whether the goal event arrives at all
  (look for its name and scope), and `getReport` gives the page's views and
  the most clicked elements, by `data-numbers-id`.

If nothing arrives, check in this order: the test is active, the page is
published, the site renders the `_improve` block, and the site sends events
(numbers' Setup page).
