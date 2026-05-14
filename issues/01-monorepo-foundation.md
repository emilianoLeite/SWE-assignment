# 01 — Monorepo foundation: `apps/api` + `packages/models`

## What to build

Bootstrap the two missing workspace members so every subsequent slice has a place to land.

**`packages/models`** — shared Mongoose schemas and TypeScript types for all domain entities: `Customer`, `Conversation`, `Message`, `Operator`. These types are imported by both `apps/api` (runtime schemas) and `apps/web` (type-safe API responses). No business logic here — schemas and types only.

**`apps/api`** — NestJS application skeleton with:
- MongoDB connection via Mongoose (connection string from env `MONGODB_URI`)
- A health-check route (`GET /health → 200 OK`) to verify the stack is wired
- Turborepo `dev` and `build` tasks configured so `turbo run dev` starts both `apps/api` and `apps/web`

The prototype in `apps/web/src/components/prototype/` is untouched — it stays as visual reference throughout implementation.

## Acceptance criteria

- [x] `packages/models` exports Mongoose schemas and matching TypeScript types for Customer, Conversation, Message, Operator
- [x] `apps/api` starts with `npm run dev` (or `turbo run dev` from root) and connects to MongoDB
- [x] `GET /health` returns `200 OK`
- [x] `apps/web` can import types from `packages/models` without errors
- [x] `turbo run dev` starts both apps concurrently

## Blocked by

None — can start immediately.
