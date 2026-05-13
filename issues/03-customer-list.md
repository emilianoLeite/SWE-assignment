# 03 — Customer list: left panel (`GET /customers`)

## What to build

The left panel of the unified inbox showing a real list of Customers sorted by `lastActivityAt` desc, with the urgency badge derived from live data.

**API — `GET /customers`**

Query params: `brandId` (required), `status`, `assigneeId`, `tags`, `campaign`, `from`, `to` (date range on `lastActivityAt`).

Response per customer:
- `_id`, `name`, `lastActivityAt`
- `urgencyStatus` — the most urgent status across all their conversations. Urgency order: `to_manage > human_controlled > ai_controlled > managed > blocked`

All filters resolve at the Customer level ("customers who have at least one Conversation matching the selected value"). Sorted by `lastActivityAt` desc via the `{ brandId: 1, lastActivityAt: -1 }` index.

**Frontend — left panel**

Wire the existing prototype customer list to this endpoint via React Query. Replace prototype `seed-data.ts` references in the left panel only. Each row: customer name, urgency status badge (color from design tokens), `lastActivityAt` timestamp. Selected row: left border `primary-500`.

## Acceptance criteria

- [ ] `GET /customers` returns customers sorted by `lastActivityAt` desc
- [ ] `urgencyStatus` reflects the most urgent status across all conversations for that customer
- [ ] Each filter param (`status`, `assigneeId`, `tags`, `campaign`, `from`/`to`) narrows results at the Customer level
- [ ] Frontend left panel renders real data from the API
- [ ] Status badge colors match design tokens (`warning` for `to_manage`, `success` for `managed`, `destructive` for `blocked`, `primary` for `ai_controlled`)
- [ ] Selecting a customer highlights the row with a left `primary-500` border

## Blocked by

- #02 — Seed data
