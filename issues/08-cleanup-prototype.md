# 08 — Cleanup: remove prototype scaffolding

## What to build

Remove throwaway prototype code now that the real implementation is complete, and move the unified inbox to its canonical route.

**Deletions:**
- `apps/web/src/components/prototype/VariantB.tsx`
- `apps/web/src/components/prototype/VariantC.tsx`
- `apps/web/src/components/prototype/PrototypeSwitcher.tsx`
- `apps/web/src/components/prototype/seed-data.ts` (if no longer imported anywhere)
- `apps/web/src/app/prototype/` directory

**Route change:**
- Move the real unified inbox from wherever it lives during development to `/inbox/unified`
- Update `apps/web/src/app/page.tsx` redirect to point to `/inbox/unified`

**Verify nothing breaks:**
- `turbo run build` passes with no type errors
- No dangling imports referencing deleted files

## Acceptance criteria

- [x] VariantB.tsx, VariantC.tsx, PrototypeSwitcher.tsx are deleted
- [x] seed-data.ts is deleted (or confirmed still needed and kept)
- [x] `/prototype/unified-inbox` route no longer exists
- [x] Real inbox is accessible at `/inbox/unified`
- [x] Root `/` redirects to `/inbox/unified`
- [x] `turbo run build` passes cleanly

## Blocked by

- #06 — Reply box + AI toggle
- #07 — Filter panel
