# 04 — Customer timeline: center panel (`GET /customers/:id/timeline`)

## What to build

The center panel of the unified inbox: a single chronological timeline of all messages across all of a customer's conversations, grouped into Conversation Blocks by channel.

**API — `GET /customers/:id/timeline`**

Returns a list of Conversation Blocks, each containing:
- `channel` (`whatsapp` | `email` | `voice` | `onsite`)
- `conversationId`
- `channelData` — channel-specific header fields:
  - Email: `subject`
  - Voice: `duration`, `outcome`, `transcript[]`
  - WhatsApp / On-site: nothing extra
- `messages[]` — sorted by `sentAt` asc

Grouping rule: consecutive messages belonging to the same **channel** (not conversation ID) are merged into one block. Two separate WhatsApp conversations with no intervening other-channel message become one WhatsApp block.

**Frontend — center panel (conversation area)**

Replace prototype hardcoded timeline with real API data via React Query. Render each Conversation Block with the channel's color. Block headers:
- Email: subject line
- Voice: "Call · {duration} · {outcome}" + full transcript
- WhatsApp / On-site: no header

Messages within a block: distinguish `sentBy` (customer / ai / operator) with alignment or label.

## Acceptance criteria

- [x] `GET /customers/:id/timeline` returns blocks in chronological order
- [x] Consecutive same-channel messages are merged into one block
- [x] Voice block includes transcript from `channelData.transcript`; no `messages` entry needed
- [x] Frontend renders blocks with correct channel color coding
- [x] Block headers appear for email and voice; absent for WhatsApp and on-site
- [x] `sentBy` is visually distinguishable within each message

## Blocked by

- #03 — Customer list: left panel
