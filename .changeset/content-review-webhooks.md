---
'@obelism/content': minor
---

Webhook types for review before publishing: `entry.review_requested` (`{ entry, revision, note }`) and `entry.review_closed` (`{ entry, outcome: 'approved' | 'sent_back', revision, reason? }`), sent by environments whose publishing is reviewed.
