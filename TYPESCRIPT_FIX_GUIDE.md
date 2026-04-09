# TypeScript Fix Guide — Direct Publishing Implementation

## Overview
This guide provides step-by-step fixes for all TypeScript compilation errors introduced by the direct publishing refactor. Follow the fixes in the order specified to avoid cascading errors.

---

## Part 1: Schema Fixes (Fix First)

### Error 1.1: Missing `tinyint` import in schema.ts
**File:** `drizzle/schema.ts`  
**Error:** `Cannot find name 'tinyint'`  
**Lines:** 32, 37, 51, 64, 77, 152

**Root Cause:** The introspected schema uses `tinyint()` but it's not imported from drizzle-orm.

**Fix:**
```typescript
// At the top of drizzle/schema.ts, add to imports:
import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  mysqlEnum,
  tinyint,  // ← ADD THIS
  index,
} from "drizzle-orm/mysql-core";
```

**Validation:**
```bash
pnpm tsc --noEmit | grep "tinyint"
# Should return no errors
```

---

### Error 1.2: Missing `mediaUploads` table export
**File:** `drizzle/schema.ts`  
**Error:** `Module has no exported member 'mediaUploads'`  
**Referenced in:** `server/imageHandler.ts(4,10)`

**Root Cause:** The schema was introspected but `mediaUploads` table is referenced in imageHandler.ts but not exported.

**Fix Option A:** If `mediaUploads` table exists in database:
```bash
# Run introspect again to ensure all tables are captured
pnpm drizzle-kit introspect
```

**Fix Option B:** If `mediaUploads` is not needed, remove the import:
```typescript
// In server/imageHandler.ts, line 4
// Remove this line:
// import { mediaUploads } from "../drizzle/schema";

// Or comment out code that uses it
```

**Recommended:** Use Option B for now (mediaUploads not part of MVP)

**Validation:**
```bash
grep -n "mediaUploads" /home/ubuntu/content-creator-hub/server/imageHandler.ts
# Check if it's actually used
```

---

## Part 2: Database Helper Fixes

### Error 2.1: Date type mismatches in db.ts
**File:** `server/db.ts`  
**Errors:**
- Line 420: `Type 'Date' is not assignable to type 'string | SQL<unknown> | undefined'`
- Line 493: `Type 'Date' is not assignable to type 'string | SQL<unknown> | null | undefined'`

**Root Cause:** Drizzle ORM with `mode: 'string'` expects ISO string dates, not Date objects.

**Fix:**
```typescript
// In db.ts, find all places where you set timestamp fields
// Change from:
const now = new Date();
await db.insert(table).values({ createdAt: now });

// Change to:
const now = new Date().toISOString();
await db.insert(table).values({ createdAt: now });

// Or use SQL helper:
import { sql } from "drizzle-orm";
await db.insert(table).values({ createdAt: sql`NOW()` });
```

**Specific Locations to Fix:**
1. Search for `new Date()` assignments to timestamp fields
2. Replace with `.toISOString()` or `sql\`NOW()\``

**Validation:**
```bash
pnpm tsc --noEmit | grep "db.ts"
# Should show no errors
```

---

### Error 2.2: Drizzle query type mismatches
**File:** `server/db.ts`  
**Errors:**
- Line 178-179: `No overload matches this call` for `lte()` and `gte()`

**Root Cause:** Comparing timestamp string columns with Date objects.

**Fix:**
```typescript
// Change from:
where(
  and(
    lte(scheduledPosts.scheduledAt, new Date()),
    gte(scheduledPosts.publishedAt, new Date())
  )
)

// Change to:
where(
  and(
    lte(scheduledPosts.scheduledAt, new Date().toISOString()),
    gte(scheduledPosts.publishedAt, new Date().toISOString())
  )
)

// Or use sql helper:
where(
  and(
    sql`${scheduledPosts.scheduledAt} <= NOW()`,
    sql`${scheduledPosts.publishedAt} >= NOW()`
  )
)
```

**Validation:**
```bash
pnpm tsc --noEmit | grep "db.ts" | grep -E "lte|gte"
```

---

## Part 3: Schedule Router Fixes

### Error 3.1: Date assignment in scheduleRouter.ts
**File:** `server/scheduleRouter.ts`  
**Errors:**
- Line 96: `Type 'Date' is not assignable to type 'string'`
- Line 173: Same error
- Line 213: Same error

**Root Cause:** Setting timestamp fields with Date objects instead of ISO strings.

**Fix:**
```typescript
// In scheduleRouter.ts, find all date assignments:

// Change from:
const scheduled = await db.insert(scheduledPosts).values({
  scheduledAt: new Date(input.scheduledAt),
  createdAt: new Date(),
  ...
});

// Change to:
const scheduled = await db.insert(scheduledPosts).values({
  scheduledAt: new Date(input.scheduledAt).toISOString(),
  createdAt: new Date().toISOString(),
  ...
});
```

**Specific Lines:**
- Line 96: `publishingStartedAt` assignment
- Line 173: `scheduledAt` assignment  
- Line 213: `nextRetryAt` assignment

**Validation:**
```bash
pnpm tsc --noEmit | grep "scheduleRouter.ts"
```

---

### Error 3.2: Missing `insertId` property
**File:** `server/scheduleRouter.ts`  
**Error:** Line 99: `Property 'insertId' does not exist on type '{}'`

**Root Cause:** Drizzle ORM doesn't return `insertId` directly. Use `lastInsertRowid` or query the inserted row.

**Fix:**
```typescript
// Change from:
const result = await db.insert(scheduledPosts).values({...});
const postId = result.insertId;

// Change to (Option A - Get from result):
const result = await db.insert(scheduledPosts).values({...});
// Drizzle returns the values, not insertId
// Query it back:
const [inserted] = await db.select().from(scheduledPosts)
  .where(eq(scheduledPosts.id, result[0].id))
  .limit(1);
const postId = inserted.id;

// Or Option B (Better - MySQL specific):
const result = await db.execute(
  sql`INSERT INTO scheduled_posts (...) VALUES (...)`
);
const postId = result[0].insertId;
```

**Recommended:** Use Option A (Drizzle-native)

**Validation:**
```bash
pnpm tsc --noEmit | grep "scheduleRouter.ts" | grep "insertId"
```

---

## Part 4: Publishing Worker Fixes

### Error 4.1: Missing `db` export
**File:** `server/jobs/publishingWorker.ts`  
**Error:** Line 1: `Module has no exported member 'db'`

**Root Cause:** publishingWorker imports `{ db }` but db.ts exports `getDb()` function, not `db` object.

**Fix:**
```typescript
// Change from:
import { db } from "../db";

// Change to:
import { getDb } from "../db";

// Then use:
const db = await getDb();
```

**All occurrences in publishingWorker.ts:**
- Line 1: Fix import
- Line 58+: Change `db.select()` to `(await getDb()).select()`

**Validation:**
```bash
pnpm tsc --noEmit | grep "publishingWorker.ts" | grep "db"
```

---

### Error 4.2: Missing `publishingJobs` export
**File:** `server/jobs/publishingWorker.ts`  
**Error:** Line 2: `Module has no exported member 'publishingJobs'`

**Root Cause:** publishingJobs table exists in schema but not imported in publishingWorker.

**Fix:**
```typescript
// Add to imports:
import {
  scheduledPosts,
  publishingJobs,  // ← ADD THIS
} from "../../drizzle/schema";
```

**Validation:**
```bash
grep "export const publishingJobs" /home/ubuntu/content-creator-hub/drizzle/schema.ts
# Should find the table definition
```

---

### Error 4.3: Type parameter in transaction
**File:** `server/jobs/publishingWorker.ts`  
**Error:** Line 58: `Parameter 'tx' implicitly has an 'any' type`

**Root Cause:** Missing type annotation for transaction parameter.

**Fix:**
```typescript
// Change from:
const claimed = await db.transaction(async (tx) => {

// Change to:
import type { MySqlTransaction } from "drizzle-orm/mysql-core";
const claimed = await db.transaction(async (tx: MySqlTransaction<...>) => {

// Or simpler:
const claimed = await db.transaction(async (tx: any) => {
  // TypeScript will infer types from tx methods
```

**Validation:**
```bash
pnpm tsc --noEmit | grep "publishingWorker.ts" | grep "tx"
```

---

### Error 4.4: Invalid status enum value
**File:** `server/jobs/publishingWorker.ts`  
**Error:** Line 62: `Argument of type '"scheduled"' is not assignable to type 'SQLWrapper | "published" | "failed" | "pending" | "cancelled"'`

**Root Cause:** Schema was updated with new status values but TypeScript still sees old enum.

**Fix:**
```typescript
// The schema.ts should have:
status: mysqlEnum(['scheduled','publishing','published','failed','cancelled','reconnect_required'])

// If it doesn't, regenerate:
pnpm drizzle-kit introspect

// Then verify in schema.ts:
grep -A 2 "status.*mysqlEnum" /home/ubuntu/content-creator-hub/drizzle/schema.ts
```

**Validation:**
```bash
pnpm tsc --noEmit | grep "publishingWorker.ts" | grep "scheduled"
```

---

## Part 5: Frontend Fixes

### Error 5.1: ContentCalendar type issues
**File:** `client/src/pages/ContentCalendar.tsx`  
**Errors:**
- Line 37: `Object literal may only specify known properties, and 'from' does not exist`
- Line 89: `Type 'number' is not assignable to type 'Date'`

**Root Cause:** Filter object has wrong shape; date field expects Date not number.

**Fix:**
```typescript
// Line 37 - Change from:
const [filters, setFilters] = useState({
  from: new Date(),
  to: new Date(),
  status: "published",
});

// Change to (match tRPC input type):
const [filters, setFilters] = useState({
  status: "published" as const,
  // Remove 'from' and 'to' if not in tRPC input
});

// Line 89 - Change from:
scheduledAt: timestamp.getTime(),

// Change to:
scheduledAt: timestamp.toISOString(),
```

**Validation:**
```bash
pnpm tsc --noEmit | grep "ContentCalendar.tsx"
```

---

### Error 5.2: ContentGenerator type issues
**File:** `client/src/pages/ContentGenerator.tsx`  
**Error:** Line 66: `Property 'id' does not exist on type '{}'`

**Root Cause:** Response type is not properly typed.

**Fix:**
```typescript
// Add proper type annotation:
const { data: post } = trpc.content.getPost.useQuery(
  { id: postId },
  {
    enabled: !!postId,
  }
);

// Ensure the tRPC procedure returns proper type:
// In server/routers.ts, verify:
getPost: publicProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ input }) => {
    // Return full post object with id
    return { id: input.id, ...postData };
  }),
```

**Validation:**
```bash
pnpm tsc --noEmit | grep "ContentGenerator.tsx"
```

---

## Part 6: Context Fixes

### Error 6.1: Missing User type export
**File:** `server/_core/context.ts`  
**Error:** `Module has no exported member named 'User'`

**Root Cause:** User type was not exported from db.ts.

**Fix:**
Already fixed in Part 1 when we added:
```typescript
export type User = InferSelectModel<typeof users>;
```

**Validation:**
```bash
pnpm tsc --noEmit | grep "context.ts" | grep "User"
```

---

## Part 7: SDK Fixes

### Error 7.1: Missing User type in sdk.ts
**File:** `server/_core/sdk.ts`  
**Error:** `Module has no exported member named 'User'`

**Root Cause:** Same as Error 6.1

**Fix:**
```typescript
// In server/_core/sdk.ts, change from:
import { User } from "../../drizzle/schema";

// Change to:
import type { User } from "../db";
```

**Validation:**
```bash
pnpm tsc --noEmit | grep "sdk.ts" | grep "User"
```

---

## Fix Order (Critical)

1. **First:** Fix schema.ts (Part 1) — Fixes foundation
2. **Second:** Fix db.ts (Part 2) — Fixes database layer
3. **Third:** Fix scheduleRouter.ts (Part 3) — Fixes API layer
4. **Fourth:** Fix publishingWorker.ts (Part 4) — Fixes job executor
5. **Fifth:** Fix context.ts and sdk.ts (Part 6-7) — Fixes auth layer
6. **Sixth:** Fix frontend (Part 5) — Fixes UI layer

---

## Validation Steps

### After Each Fix:
```bash
pnpm tsc --noEmit 2>&1 | grep "error TS" | wc -l
# Should decrease with each fix
```

### After All Fixes:
```bash
# Should return 0 errors
pnpm tsc --noEmit
echo "Exit code: $?"
```

### Build Test:
```bash
pnpm build
# Should complete without errors
```

### Dev Server Test:
```bash
pnpm dev
# Should start without TypeScript errors
# Check console for runtime errors
```

---

## Breaking Changes to Watch For

1. **Date Handling:** All timestamp fields now expect ISO strings, not Date objects
2. **Insert Results:** No `insertId` property; use query to get inserted row
3. **Status Enum:** New values added (`scheduled`, `publishing`, `reconnect_required`)
4. **Transaction Type:** May need explicit type annotations

---

## Quick Reference: Common Patterns

### Correct Date Handling:
```typescript
// ✅ Correct
const now = new Date().toISOString();
const future = new Date(Date.now() + 3600000).toISOString();

// ❌ Wrong
const now = new Date();
```

### Correct Query Comparisons:
```typescript
// ✅ Correct
where(lte(table.createdAt, new Date().toISOString()))

// ❌ Wrong
where(lte(table.createdAt, new Date()))
```

### Correct Insert with ID Retrieval:
```typescript
// ✅ Correct
const result = await db.insert(table).values({...});
const [inserted] = await db.select().from(table)
  .where(eq(table.id, result[0].id));

// ❌ Wrong
const id = result.insertId;
```

---

## Summary

| Part | Files | Errors | Priority |
|------|-------|--------|----------|
| 1 | schema.ts | 7 | CRITICAL |
| 2 | db.ts | 3 | CRITICAL |
| 3 | scheduleRouter.ts | 3 | HIGH |
| 4 | publishingWorker.ts | 4 | HIGH |
| 5 | ContentCalendar.tsx, ContentGenerator.tsx | 3 | MEDIUM |
| 6-7 | context.ts, sdk.ts | 2 | MEDIUM |

**Total Errors to Fix:** 22  
**Estimated Time:** 30-45 minutes  
**Difficulty:** Medium (mostly type annotations and date handling)

---

## Next Steps After Fixes

1. Run full TypeScript check
2. Start dev server
3. Run test suite for publishingWorker
4. Manually test scheduling flow
5. Verify database state after publishing

