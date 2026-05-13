## Issue 01 — Monorepo foundation

- **NestJS schema classes need `"strictPropertyInitialization": false`** — class properties decorated with `@Prop()` are populated by Mongoose at runtime, not in constructors. Without this flag, TypeScript strict mode rejects every schema property. Set it in both `packages/models/tsconfig.json` and `apps/api/tsconfig.json`.

- **Supertest default import** — NestJS e2e test templates show `import * as request from 'supertest'`, but with `"esModuleInterop": true` and strict TypeScript, the default export must be imported as `import request from 'supertest'`. The namespace-style import has no call signatures and causes a TS2349 error.

- **ts-jest `globals` is deprecated** — configure ts-jest options inline in `transform` as `["ts-jest", { /* options */ }]` rather than under the top-level `globals.ts-jest` key, to avoid deprecation warnings in Jest output.

- **E2e tests for infrastructure-free endpoints should bypass AppModule** — the health endpoint has no DB dependency. Using `Test.createTestingModule({ controllers: [HealthController] })` avoids requiring a live MongoDB connection in the test environment, making the test fast and self-contained.

- **workspace symlink lives in root `node_modules`** — with npm workspaces, `@textyess/models` is hoisted to the root `node_modules/@textyess/models`. Apps do not get their own copy in `apps/web/node_modules`. TypeScript resolves it from the root automatically; no `paths` alias is needed in `apps/web/tsconfig.json`.
