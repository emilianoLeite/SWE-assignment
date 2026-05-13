# 05 — Customer details: right panel (`GET /customers/:id`)

## What to build

The right panel of the unified inbox showing full customer details, wired to real data.

**API — `GET /customers/:id`**

Returns the full Customer record: `name`, `email`, `phone`, `lifetimeSpend`, `tags[]`, `notes`, `lastOrder` (embedded: `id`, `placedAt`), `createdAt`.

**Frontend — right panel**

Wire the existing prototype right panel to this endpoint via React Query. Layout matches `mockups/customer_details.png`:
- ALL-CAPS field labels
- Email, Phone, "Customer for" (derived from `createdAt`), Lifetime spend
- Tags list
- "Edit contact info" link (renders static / non-functional for MVP)
- Notes field (display only)
- Last order card (`lastOrder.id`, `lastOrder.placedAt`)

## Acceptance criteria

- [ ] `GET /customers/:id` returns all required customer fields
- [ ] Right panel renders real data from the API
- [ ] Field labels are ALL-CAPS
- [ ] "Customer for" is computed from `createdAt` relative to today
- [ ] Tags render as pills
- [ ] Last order card shows order ID and date

## Blocked by

- #03 — Customer list: left panel
