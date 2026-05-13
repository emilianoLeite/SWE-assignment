# 07 — Filter panel

## What to build

The filter panel in the unified inbox header, wired to real data. Filters narrow the customer list in the left panel.

**Additional API endpoints needed:**

- `GET /operators` — list all operators (`_id`, `name`) for the Assignee dropdown
- `GET /conversations/campaigns?brandId=` — distinct non-null campaign values for the Campaign filter (uses MongoDB `distinct()` on an indexed field)

**Frontend — filter panel**

Filters available in the unified inbox (per CONTEXT.md):
- **Status** — multi-select: `ai_controlled`, `to_manage`, `managed`, `blocked`
- **Assignee** — dropdown populated from `GET /operators`; "Unassigned" option included
- **Tags** — multi-select; values derived from existing customer tags in seed data
- **Campaign** — dropdown populated from `GET /conversations/campaigns`
- **Last Activity** — date range picker on `lastActivityAt`

Active filters are passed as query params to `GET /customers`. Clearing a filter removes its param. Filter state lives in URL search params so the view is shareable.

Layout matches `mockups/status_filter.png`, `mockups/campaing_filter.png`, `mockups/last_activity_filter.png`.

## Acceptance criteria

- [ ] `GET /operators` returns all seeded operators
- [ ] `GET /conversations/campaigns` returns distinct campaign values
- [ ] Status filter narrows customer list to customers with at least one matching conversation
- [ ] Assignee filter narrows to customers with at least one conversation assigned to that operator
- [ ] Tags filter narrows to customers whose `tags[]` includes the selected value
- [ ] Campaign filter narrows to customers with at least one conversation matching the campaign
- [ ] Last Activity date range filters by `customer.lastActivityAt`
- [ ] Filter state is reflected in URL search params

## Blocked by

- #03 — Customer list: left panel
