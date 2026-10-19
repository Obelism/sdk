---
'@obelism/improve-sdk': minor
'@obelism/numbers-sdk': minor
---

An optional `spaceId`: the space (one site or project of the organization) to work in. The improve SDK loads that space's datafile and both send it with every event; the numbers script takes `data-space`. Without it, everything goes to the organization's first space, as before. Needs improve and numbers with spaces (Obelism/obelism#110 and #113) deployed.
