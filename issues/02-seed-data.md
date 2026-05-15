# 02 — Seed data

## What to build

A runnable seed script (`apps/api/src/seed.ts`, invokable via `npm run seed`) that populates a fresh MongoDB database with enough realistic data to demonstrate every feature of the unified inbox.

Entities to create:

| Collection | Count | Notes |
|---|---|---|
| Brand | 1 | Hardcoded ID used as `brandId` across all documents. No auth layer. |
| Operators | 3–4 | Realistic names and email addresses |
| Customers | 5 | Mix of channels; at least one customer with conversations in 3+ channels |
| Conversations | ~12 | Cover all 4 channels (WhatsApp, email, voice, on-site); mix of statuses and types |
| Messages | ~60 | Realistic Italian e-commerce content; include button-type messages for WhatsApp |

Voice conversations: transcript embedded in `channelData.transcript[]`, no separate messages.

All other channels: messages in the `messages` collection.

`customer.lastActivityAt` must be denormalized from the most recent message across all their conversations.

Required indexes created by the seed script:
```
{ brandId: 1, lastActivityAt: -1 }
{ brandId: 1, status: 1, lastActivityAt: -1 }
{ brandId: 1, channel: 1, status: 1, lastActivityAt: -1 }
{ brandId: 1, type: 1, lastActivityAt: -1 }
```

## Acceptance criteria

- [x] `npm run seed` runs without errors against a local MongoDB instance
- [x] All 4 channels represented in at least one conversation
- [x] All conversation statuses represented (`ai_controlled`, `to_manage`, `managed`, `blocked`)
- [x] Both conversation types represented (`inbound`, `outbound`)
- [x] At least one customer has conversations in 3+ channels (to exercise the timeline grouping)
- [x] `customer.lastActivityAt` is populated and reflects the most recent message
- [x] Required indexes exist after seeding

## Blocked by

- #01 — Monorepo foundation: `apps/api` + `packages/models`
