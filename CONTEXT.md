# TextYess Unified Inbox

A unified inbox feature for TextYess — an AI-first e-commerce CRM — that brings conversations from multiple channels (WhatsApp, email, voice, on-site) into a single coherent view for operators.

## Language

**Brand**:
The e-commerce company that subscribes to TextYess and whose operators use the inbox.
_Avoid_: Tenant, organization, account, shop

**Operator**:
A human agent working for a Brand who triages and responds to conversations. Stored in a minimal `operators` collection: `_id`, `name`, `email`. Seeded with 3–4 fake operators for the demo. Conversations reference an Operator via `assigneeId` (nullable — a Conversation may be unassigned). A Customer has at most one assigned Operator at a time — see Business rules.
_Avoid_: User, agent, rep

**Conversation**:
The top-level entity representing an interaction between a Brand and a Contact across any single channel. Stored in a single `conversations` collection with a `channel` discriminator.
_Avoid_: Thread, chat, ticket

**Customer**:
A known or partially-known person on the customer side of a Conversation. First-class collection. Fields: `name`, `email`, `phone`, `lifetimeSpend`, `tags[]`, `notes`, `createdAt`, `visitorId` (sparse — on-site anonymous visitors only), `lastOrder` (embedded object with `id` and `placedAt`, hardcoded in seed data for the demo).
_Avoid_: Contact, user, lead

**Channel**:
The medium of a Conversation — one of `whatsapp`, `email`, `voice`, or `onsite`. All four are in scope for MVP. Email is stubbed: no threads, no CC/BCC; displays main body text, attachment list, and a link to the full email.
_Avoid_: Type, source, platform

**Campaign**:
A nullable free-text string field on Conversation identifying the marketing campaign that originated it (e.g. `"Summer Sale"`). Used to power the Campaign filter in per-channel inboxes via `distinct()` on an indexed field — no separate collection needed for the MVP. A first-class `campaigns` collection with lifecycle management is a v2 concern.
_Avoid_: Separate campaigns collection (MVP); storing as a tag in `tags[]`

**ChannelData**:
The channel-specific payload attached to a Conversation (e.g. subject line for email, duration for voice). Stored as a sub-document; heavy content (transcripts, email bodies) lives in the `messages` collection.
_Avoid_: Metadata, payload, extra

**aiActive**:
Top-level boolean field on a Conversation. Controlled independently per Conversation — disabling AI on a WhatsApp Conversation has no effect on an Email Conversation and vice versa. When `false`, the operator reply box is enabled for that Conversation. On-site Conversations ignore this field (always AI-managed). Voice Conversations ignore this field (always read-only — no reply box).
_Avoid_: Embedding in ChannelData; deriving from `status`; treating as a per-Customer or per-channel global flag

**Message**:
A single unit of content within a Conversation (text, button, media, transcript segment). The `sentBy` field identifies the sender as `customer`, `ai`, or `operator`. The stream is append-only — a button tap by the customer creates a new inbound `text` Message with the button label as content; the original button Message is never mutated.
_Avoid_: Event, entry, item

## Relationships

- A **Brand** has many **Conversations**
- A **Conversation** belongs to exactly one **Brand** and one **Channel**
- A **Conversation** is linked to one **Customer**
- A **Conversation** contains many **Messages**
- A **Conversation** has one **ChannelData** sub-document

## Business rules

- An operator can only reply to a **WhatsApp** or **Email** Conversation when the AI is not active (`aiActive: false`)
- **On-site** Conversations are always AI-managed — the operator reply box is never rendered
- **Voice** Conversations are always initiated by the Customer (always inbound) — the AI toggle is not rendered
- **On-site** Conversations can be initiated by anonymous visitors or logged-in customers. For anonymous visitors, `visitorId` is a generated session ID and a sparse Customer record is created. For logged-in customers, `visitorId === customerId` — the Conversation is automatically linked to the existing Customer record at creation time.
- A **Customer** has at most one assigned **Operator** at a time. All of a Customer's Conversations share the same `assigneeId` (or are unassigned), regardless of channel. Ownership is conceptually at the Customer level even though `assigneeId` is stored per-Conversation — keeping it per-Conversation avoids a schema change and lets unassigned channels stay null, but every write must keep the values consistent across that Customer's Conversations.

## Message storage

Voice transcripts are embedded directly in `channelData.transcript` — a voice call produces exactly one transcript, so the array-growth and pagination problems don't apply. All other channels (WhatsApp, email, on-site) store messages in a separate `messages` collection, referenced by `conversationId`.

**Tradeoffs of embedding messages in the Conversation document (not done, documented for reference):**

| Risk | Detail |
|---|---|
| 16MB document limit | Long WhatsApp threads or large transcripts can hit MongoDB's hard ceiling, requiring application-level overflow handling |
| Write amplification | Every new message rewrites the full Conversation document; MongoDB physically relocates it on disk as the array grows, degrading write throughput over time |
| No pagination | Embedded arrays must be fetched whole; loading "last 20 messages" requires pulling the entire document and slicing in application memory |
| No message-level indexing | Individual message fields (sentAt, sentBy, content) can't be independently indexed, blocking efficient search and analytics |

## Inbox structure

The product has two layers:
1. **Per-channel inboxes** — existing views scoped to a single channel (WhatsApp, On-site, Voice, Email). Unchanged.
2. **Unified inbox ("All Conversations")** — new top-level view in the sidebar, above the per-channel entries.

### Unified inbox — left panel
Lists **Customers** (not individual Conversations), sorted by `lastActivityAt` desc. Each customer row shows:
- Customer name
- **Single most-urgent status badge** derived from all their active Conversations. Urgency order (most → least): `to_manage` > `human_controlled` > `ai_controlled` > `managed` > `blocked`
- Last activity timestamp

No channel icons on the row.

**Filters available in the unified inbox**: Status · Assignee · Tags · Campaign · Last Activity (date range on `lastActivityAt`). All filters except Last Activity resolve at the Customer level — "customers who have at least one Conversation matching the selected value." Type (Inbound/Outbound) is intentionally absent — a Customer typically has both, making it an ineffective triage dimension at this level.

**Filters available in per-channel inboxes**: Status · Type (Inbound/Outbound) · Assignee · Tags · Campaign · Last Activity.

`lastActivityAt` is denormalized onto the Customer document and updated whenever any of their Conversations changes. This makes the Last Activity filter and the default sort (`lastActivityAt` desc) a fast index scan: `{ brandId: 1, lastActivityAt: -1 }`.

### Unified inbox — detail view (right panel)
When an operator selects a Customer, the detail view renders a **single chronological timeline** of all messages across all that customer's Conversations, ordered by `sentAt` (or `createdAt` for Voice).

**Conversation Blocks**: Consecutive messages belonging to the same **Channel** are grouped into a Conversation Block and rendered with a channel-specific color. "Same channel" is the grouping key — not conversation ID. Two separate WhatsApp conversations with no intervening message from another channel are merged into one WhatsApp block.

### Unified inbox — reply box
A single reply box at the bottom of the detail view with a **channel dropdown** (Email | WhatsApp). On-site and Voice are never available in the dropdown. The dropdown is always visible; an option is disabled if the customer has no existing Conversation in that channel, or if the most recent Conversation in that channel has `aiActive: true`. This rule applies to both WhatsApp and Email. Operators cannot create new Conversations from the unified view.

Block headers carry channel-specific context:
- **Email**: subject line
- **Voice**: "Call · {duration} · {outcome}" followed by the full transcript
- **WhatsApp / On-site**: no header (customer name is already shown at the top of the detail view)

## Identity Resolution

When a new conversation or order arrives, the system attempts to link it to an existing Customer by matching available identifiers (`phone`, `email`, `visitorId`).

**MVP behaviour — enrichment only:**
If an incoming interaction provides an identifier not yet on a Customer record (e.g. an order adds an email to a phone-only Customer), the field is written automatically. No operator confirmation required. This covers the common lifecycle: anonymous WhatsApp message → voice call from same number → order provides email and name.

**V2 — contact information matching logic (deferred):**
Resolving the case where two *separate* Customer records turn out to be the same person (e.g. Customer A known by phone, Customer B known by email, order links them) requires a merge operation and is deferred to v2. Techniques under consideration: phone on order, `visitorId` continuity, promo code redemption (high confidence); name + shipping address, name + email domain (medium confidence, operator review required).

**Legal constraints (apply to v2 merge logic):**
- Every merge must be written to an audit log (timestamp, identifiers used, confidence signals) — required for GDPR Art. 5 accountability.
- Merges must be reversible: unmerge re-points Conversations back to their original Customer via `customerId`.
- Auto-merge is only permitted above a high-confidence threshold (single strong signal or two corroborating medium signals). Weaker matches go to an operator review queue.
- Incorrect merges risk GDPR Art. 5 (accuracy), Art. 15 (right of access), Art. 17 (right to erasure) violations, and consent contamination for marketing channels.

## Future improvements

- **Real-time updates**: Replace polling (current) with Server-Sent Events (SSE) — server pushes events on new messages or status changes, client invalidates React Query cache. Zero polling overhead, sub-second latency.
- **Marketing / Sales outbound**: Creating new outbound Conversations to new or existing Customers (e.g. sending a first WhatsApp message to a lead). Deferred post-MVP — the unified inbox is read-focused for the demo.
- **`lastActivityAt` write decoupling**: MVP synchronously denormalizes `lastActivityAt` onto the Customer document on every message write. Under high throughput (AI responding to many customers in parallel), this creates write contention on the Customer document. Production fix: emit an event on message creation and update `customer.lastActivityAt` asynchronously via a background worker — keeps the main write path lean and handles bursts without document-level contention.

## Conversation fields: status and type

Two orthogonal, explicit, indexed fields on every Conversation:

**`status`** — mutable state of the conversation:
- `ai_controlled` — AI is handling it (`aiActive: true`)
- `to_manage` — AI is off, customer is waiting for a response
- `managed` — AI is off, no pending customer attention needed (resolved)
- `blocked` — customer is blocked from sending further messages
- `human_controlled` — legacy value, kept for backward compatibility; not used in new transitions

**`type`** — immutable direction in the marketing sense, set at creation time:
- `inbound` — customer-initiated ("pulling")
- `outbound` — brand-initiated ("pushing")

Both fields appear as options in the filter panel UI. Counts are computed via a single `$facet` aggregation (`byStatus` + `byType`). Required indexes:
```
{ brandId: 1, status: 1, lastActivityAt: -1 }
{ brandId: 1, channel: 1, status: 1, lastActivityAt: -1 }
{ brandId: 1, type: 1, lastActivityAt: -1 }
```

## Flagged ambiguities

- "tenant" was used loosely in schema discussion — resolved: the correct term is **Brand**. The `tenantId` field in the DB references a Brand; a single hardcoded Brand ID is seeded for the demo (no auth layer).
- "contact" was considered as an alternative to **Customer** but rejected — the UI, operators, and domain all say "Customer," so that is the canonical term.
