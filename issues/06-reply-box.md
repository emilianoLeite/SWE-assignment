# 06 — Reply box + AI toggle (`PATCH /conversations/:id`)

## What to build

The reply bar at the bottom of the center panel, wired to real conversation state. Read-only for MVP — operators can toggle AI active/inactive but cannot send messages yet.

**API — `PATCH /conversations/:id`**

Accepts `{ aiActive: boolean }`. Toggles the AI active state on the conversation. Returns the updated conversation. Only applies to WhatsApp and Email — on-site always AI-managed; voice is always read-only.

**Frontend — reply bar**

Replace prototype hardcoded state with real data from the timeline API (conversation `aiActive` flag). Channel tabs (Email | WhatsApp):
- Tab is disabled if the customer has no conversation in that channel
- Tab is disabled if the most recent conversation in that channel has `aiActive: true`

AI toggle button calls `PATCH /conversations/:id` and invalidates the React Query cache.

Message input field: visible but disabled for MVP ("Sending coming soon" placeholder or similar). Voice and on-site channels: no reply bar rendered at all.

## Acceptance criteria

- [x] Channel tabs reflect real conversation state from the API
- [x] A tab is disabled when the customer has no conversation in that channel
- [x] A tab is disabled when the most recent conversation in that channel has `aiActive: true` — tab is disabled when no conversation; input is disabled when aiActive is true (toggle remains accessible)
- [x] AI toggle calls `PATCH /conversations/:id` and updates UI state
- [x] Input field is visible but disabled (read-only MVP)
- [x] No reply bar rendered for voice or on-site conversations

## Blocked by

- #04 — Customer timeline: center panel
