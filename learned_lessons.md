## Issue 01 — Monorepo foundation

- **NestJS schema classes need `"strictPropertyInitialization": false`** — class properties decorated with `@Prop()` are populated by Mongoose at runtime, not in constructors. Without this flag, TypeScript strict mode rejects every schema property. Set it in both `packages/models/tsconfig.json` and `apps/api/tsconfig.json`.

- **Supertest default import** — NestJS e2e test templates show `import * as request from 'supertest'`, but with `"esModuleInterop": true` and strict TypeScript, the default export must be imported as `import request from 'supertest'`. The namespace-style import has no call signatures and causes a TS2349 error.

- **ts-jest `globals` is deprecated** — configure ts-jest options inline in `transform` as `["ts-jest", { /* options */ }]` rather than under the top-level `globals.ts-jest` key, to avoid deprecation warnings in Jest output.

- **E2e tests for infrastructure-free endpoints should bypass AppModule** — the health endpoint has no DB dependency. Using `Test.createTestingModule({ controllers: [HealthController] })` avoids requiring a live MongoDB connection in the test environment, making the test fast and self-contained.

- **workspace symlink lives in root `node_modules`** — with npm workspaces, `@textyess/models` is hoisted to the root `node_modules/@textyess/models`. Apps do not get their own copy in `apps/web/node_modules`. TypeScript resolves it from the root automatically; no `paths` alias is needed in `apps/web/tsconfig.json`.

- **NestJS route order matters for overlapping param paths** — when a controller has both `@Get(':id/timeline')` and `@Get(':id')`, declare the more specific path (`:id/timeline`) first. NestJS matches routes in registration order; placing the wildcard `@Get(':id')` first would shadow the sub-path route.

- **`CustomerModel` must be explicitly injected even when Customer schema is already in the module** — having `MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }])` in the module registers the model for DI, but each service must `@InjectModel(Customer.name)` it explicitly. Forgetting the injection causes a runtime DI error even if the model is declared in the module.

- **Lean `.findById()` doesn't include Mongoose timestamps in type** — calling `.findById(id).lean()` returns a plain JS object where `createdAt`/`updatedAt` exist at runtime (added by `@Schema({ timestamps: true })`) but aren't in the TypeScript type. Cast to `unknown as { createdAt: Date }` to access them safely without adding a type assertion hack to the schema class.

- **Use the hydrated document (non-lean) for PATCH mutations** — when you need to call `.save()` after mutating a field, don't use `.lean()`. Fetch via `findById(id)` (without `.lean()`), mutate, then `await doc.save()`. Lean gives a plain JS object with no save method.

- **Track the most-recent conversation state when merging timeline blocks** — the timeline service merges same-channel consecutive messages across multiple conversations into one visual block. When merging, update `conversationId` and `aiActive` to the latest entry's conversation so the frontend always sees the current state of the most recent conversation in that channel, not the one that started the block.

- **`useMutation` + `invalidateQueries` is the clean pattern for toggles** — when a PATCH endpoint updates a resource that's also loaded via `useQuery`, call `queryClient.invalidateQueries({ queryKey: [...] })` in `onSuccess` to re-fetch. This avoids manually reconciling optimistic state and keeps the query cache as the single source of truth.

- **`GET` route must be declared before `PATCH /:id` in NestJS** — adding `@Get('campaigns')` to the ConversationsController required placing it before `@Patch(':id')`. NestJS matches in registration order; a param route like `:id` would swallow a sibling literal segment like `campaigns` if declared first. The same principle applies whenever a literal sub-path coexists with a wildcard param segment.

- **Derive filter tag options from the customer list response rather than a separate endpoint** — `GET /customers` already aggregates per-customer data; adding `tags: '$customer.tags'` to the `$project` stage lets the frontend extract distinct tags from the already-loaded list. No new endpoint, no extra round trip.

- **Filter state in URL search params via `router.replace`** — use `useSearchParams` (read) + `router.replace` (write) from `next/navigation` to keep filter state in the URL. Always preserve unrelated params (e.g. `?variant=A`) when building the new search string. `router.replace` avoids polluting browser history on each filter change.

- **NestJS `tsconfig.build.json` + monorepo path aliases: point to `dist/`, not `src/`** — if `tsconfig.json` maps `@textyess/models` via `paths` to the package's source `.ts` files, `nest build` (which uses `tsconfig.build.json` with `rootDir: "./src"`) will fail with TS6059 because those source files are outside `rootDir`. Fix: override `paths` in `tsconfig.build.json` to point to the pre-built `dist/index` declarations instead. Turbo's pipeline already ensures the models package builds before the API.

- **Shared prototype types should live in `shared.tsx`, not `seed-data.ts`** — when cleaning up prototype scaffolding, move the canonical type definitions (`Channel`, `Status`) into the shared utility file so they remain available after `seed-data.ts` is deleted. This avoids chained import breakage across `shared.tsx` and any components that imported the types transitively.
