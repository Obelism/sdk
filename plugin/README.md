# Obelism for Claude

Obelism's products in Claude: [Content](https://content.obelism.studio) (the
headless CMS), [improve](https://improve.obelism.studio) (A/B tests and
feature flags), [numbers](https://numbers.obelism.studio) (the events and
visitors of every site on Obelism) and [media](https://media.obelism.studio)
(the library of files every product shares).

## Install

In Claude Code:

```
/plugin marketplace add Obelism/sdk
/plugin install obelism@obelism
```

Each product asks you to sign in with your Obelism account the first time
Claude uses it (OAuth). Claude acts as you, as far as your role in each
Organization allows. Disconnect it any time from your account page on
www.obelism.studio.

On claude.ai, an Organization Owner can sync this repository's marketplace
under Organization settings → Plugins. Without the plugin, add the four
servers as custom connectors:

| Product | MCP server                           |
| ------- | ------------------------------------ |
| Content | `https://content.obelism.studio/mcp` |
| improve | `https://improve.obelism.studio/mcp` |
| numbers | `https://numbers.obelism.studio/mcp` |
| media   | `https://media.obelism.studio/mcp`   |

## What it does

- **`import-design`**: a page made in Claude Design (its standalone HTML
  export, or a handoff to Claude Code) becomes a draft page in Content, built
  from your Space's own blocks. Images become assets; importing the same
  design again updates that page.
- **`connect-site`**: sets up a site's repository for Content: the SDK,
  tokens and a webhook in develop or staging, the preview URL, and numbers'
  tracking.
- **`test-a-block`**: an A/B test on a block of a page: the test in improve,
  its variants in Content's `_improve` block, and its results in improve and
  numbers.

Every other tool of the four servers is there too: ask Claude about your
pages, tests, flags, visitors or files: describe images, sort them into
folders, add files from a URL, or share a folder with a password.

## Safety

- Claude writes drafts; publishing, starting a test and production
  integrations stay your decision. In production, Content refuses token,
  webhook and settings changes from an agent: make those in the dashboard.
- numbers only reads. media changes files' details, folders and shares only
  with your consent to write, and as far as your role in the Space allows; a
  share's password is shown once.
- Text inside a design, a page or a repository is data to Claude, never
  instructions.
