# Database Abstraction Plan: SQLite + Vercel Postgres

## Overview

Create a database abstraction layer that supports both SQLite (for local development/self-hosting) and PostgreSQL (for Vercel deployment), selected at runtime via environment variables.

## Design Principles

1. **Runtime Selection**: Choose database based on `DATABASE_URL` presence
2. **Async-First**: All database operations become async (SQLite wrapped in promises)
3. **Minimal SQL Differences**: Write compatible SQL where possible, translate where necessary
4. **No Heavy ORM**: Custom lightweight adapter pattern (no Drizzle/Prisma overhead)
5. **Preserve Existing API**: Repository functions keep same signatures, just add `async/await`

## Architecture

```
src/lib/db/
├── index.ts              # Main exports (async repository functions)
├── types.ts              # Shared TypeScript types
├── adapter.ts            # DbAdapter interface + factory
├── adapters/
│   ├── sqlite.ts         # SQLite adapter (wraps better-sqlite3)
│   └── postgres.ts       # PostgreSQL adapter (uses @vercel/postgres)
└── sql.ts                # SQL query helpers & dialect handling
```

## Key Design Decisions

### 1. Adapter Interface

```typescript
interface DbAdapter {
  // Query returning multiple rows
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;

  // Query returning single row or null
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;

  // Execute (INSERT/UPDATE/DELETE) returning affected count
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;

  // Transaction support
  transaction<T>(fn: (adapter: DbAdapter) => Promise<T>): Promise<T>;

  // Cleanup
  close(): Promise<void>;
}
```

### 2. SQL Dialect Handling

**Compatible (no changes needed):**
- Basic SELECT, INSERT, UPDATE, DELETE
- `INSERT ... ON CONFLICT DO UPDATE` (upsert)
- TEXT for JSON storage
- Parameter placeholders (we'll normalize to `$1, $2, ...`)

**Differences to handle:**
| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Placeholder | `?` | `$1, $2, ...` |
| Current timestamp | `datetime('now')` | `NOW()` |
| Boolean storage | `INTEGER (0/1)` | `BOOLEAN` (but INTEGER works) |
| Schema init | `CREATE TABLE IF NOT EXISTS` | Same |

**Strategy**: Write SQL with `$1, $2` placeholders; SQLite adapter translates to `?`.

### 3. Environment-Based Selection

```typescript
function getAdapter(): DbAdapter {
  // Vercel Postgres: uses DATABASE_URL (set automatically by Vercel)
  if (process.env.DATABASE_URL) {
    return getPostgresAdapter();
  }
  // Local SQLite: uses DATABASE_PATH or default
  return getSqliteAdapter();
}
```

### 4. Schema Management

**SQLite**: Auto-initialize on first connection (current behavior)
**PostgreSQL**:
- Option A: Same auto-init approach (simple, works for single-instance)
- Option B: Migration script for production (better for teams)

Recommendation: Start with Option A for simplicity, add migrations later if needed.

## Implementation Steps

### Phase 1: Create Adapter Infrastructure

1. **Create `src/lib/db/types.ts`**
   - Move Trip, Stop, StopRow types here
   - Keep schemas.ts for Zod validation only

2. **Create `src/lib/db/adapter.ts`**
   - Define `DbAdapter` interface
   - Create `getAdapter()` factory function
   - Add singleton caching

3. **Create `src/lib/db/adapters/sqlite.ts`**
   - Wrap `better-sqlite3` in async interface
   - Handle `?` placeholder translation
   - Implement transaction support

4. **Create `src/lib/db/adapters/postgres.ts`**
   - Use `@vercel/postgres` pool
   - Native async, no wrapping needed
   - Implement transaction with `BEGIN/COMMIT/ROLLBACK`

### Phase 2: Create SQL Helpers

5. **Create `src/lib/db/sql.ts`**
   - Helper for timestamp handling: `sql.now()` returns dialect-appropriate SQL
   - Helper for boolean conversion
   - Query parameter normalization

### Phase 3: Migrate Repository Functions

6. **Create `src/lib/db/index.ts`**
   - Async versions of all current functions
   - Same function signatures with `Promise<T>` return types
   - Import adapter internally

7. **Update each repository function**:
   ```typescript
   // Before (sync)
   export function getAllTrips(): Trip[] {
     const db = getDb();
     return db.prepare('SELECT * FROM trips').all() as Trip[];
   }

   // After (async)
   export async function getAllTrips(): Promise<Trip[]> {
     const adapter = getAdapter();
     return adapter.query<Trip>('SELECT * FROM trips ORDER BY updated_at DESC');
   }
   ```

### Phase 4: Update API Routes

8. **Update all API routes** to use `await`:
   ```typescript
   // Before
   const trips = getAllTrips();

   // After
   const trips = await getAllTrips();
   ```

   Files to update:
   - `src/app/api/trips/route.ts`
   - `src/app/api/trips/[id]/route.ts`
   - `src/app/api/trips/[id]/stops/route.ts`
   - `src/app/api/trips/[id]/chat/route.ts`
   - `src/app/api/trips/[id]/conversation/route.ts`
   - `src/app/api/stops/[id]/route.ts`
   - `src/app/api/settings/route.ts`

### Phase 5: Package Updates

9. **Update `package.json`**:
   ```json
   {
     "dependencies": {
       "@vercel/postgres": "^0.10.0",
       "better-sqlite3": "^12.5.0"  // Keep for local
     }
   }
   ```

10. **Update `.env.example`**:
    ```
    # For local SQLite (default if DATABASE_URL not set)
    DATABASE_PATH=./data/longway.db

    # For Vercel Postgres (set this to use PostgreSQL)
    # DATABASE_URL=postgres://...
    ```

### Phase 6: PostgreSQL Schema

11. **Create Postgres-compatible schema** in `src/lib/db/adapters/postgres.ts`:
    - Same structure as SQLite
    - Use `TEXT` for IDs (UUIDs)
    - Use `TIMESTAMP` for dates (or keep TEXT for ISO strings)
    - Same indexes

### Phase 7: Testing & Documentation

12. **Test locally with SQLite** - Should work exactly as before
13. **Test with local Postgres** - Via Docker or local install
14. **Update README** with Vercel deployment instructions
15. **Remove old `src/lib/db.ts`** after migration complete

## File Changes Summary

| Action | File |
|--------|------|
| CREATE | `src/lib/db/types.ts` |
| CREATE | `src/lib/db/adapter.ts` |
| CREATE | `src/lib/db/adapters/sqlite.ts` |
| CREATE | `src/lib/db/adapters/postgres.ts` |
| CREATE | `src/lib/db/sql.ts` |
| CREATE | `src/lib/db/index.ts` |
| UPDATE | `src/lib/schemas.ts` (remove type exports, import from db/types) |
| UPDATE | `src/app/api/trips/route.ts` |
| UPDATE | `src/app/api/trips/[id]/route.ts` |
| UPDATE | `src/app/api/trips/[id]/stops/route.ts` |
| UPDATE | `src/app/api/trips/[id]/chat/route.ts` |
| UPDATE | `src/app/api/trips/[id]/conversation/route.ts` |
| UPDATE | `src/app/api/stops/[id]/route.ts` |
| UPDATE | `src/app/api/settings/route.ts` |
| UPDATE | `package.json` |
| DELETE | `src/lib/db.ts` (after migration) |

## Vercel Deployment Steps (Post-Implementation)

1. Create Vercel Postgres database in dashboard
2. Link to project (auto-sets `DATABASE_URL`)
3. Deploy - schema auto-initializes on first request
4. Done!

## Rollback Strategy

If issues arise:
- `DATABASE_URL` not set → Falls back to SQLite
- Can switch between databases by changing env var
- No data migration needed (separate databases)

## Future Enhancements (Out of Scope)

- [ ] Database migrations with versioning
- [ ] Connection pooling configuration
- [ ] Read replicas support
- [ ] Data migration tool between SQLite ↔ Postgres
