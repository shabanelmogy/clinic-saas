# Database Review - `api/src/db`

## 📋 Executive Summary

**Status:** ⚠️ **CRITICAL SCHEMA MISMATCH**

The database configuration is well-structured, but there's a **critical mismatch** between:
- Current database migrations (old schema without multi-tenant support)
- Current TypeScript schemas (new schema with multi-tenant support)
- RBAC tables (not yet migrated to database)

---

## 🔴 CRITICAL ISSUES

### 1. **Schema-Migration Mismatch** (BLOCKING)

**Problem:**

The TypeScript schemas have been updated for production-ready multi-tenant RBAC, but the database migrations are still using the old schema.

**Current State:**

| Aspect | TypeScript Schema | Database Migration |
|--------|------------------|-------------------|
| **Users table** | ✅ Has `clinicId` | ❌ Missing `clinicId` |
| **Users table** | ✅ No `role` column | ❌ Has `role` enum column |
| **Users table** | ✅ Email unique per clinic | ❌ Email globally unique |
| **Appointments** | ✅ Has `tenantId` | ❌ Missing `tenantId` |
| **RBAC tables** | ✅ Defined in schema | ❌ Not in database |
| **Foreign keys** | ✅ Uses `restrict` | ❌ Uses `cascade` |

**Impact:**
- 🔴 **Application will crash** - TypeScript expects `clinicId`, database doesn't have it
- 🔴 **RBAC won't work** - RBAC tables don't exist in database
- 🔴 **Multi-tenant isolation broken** - No `clinicId` filtering possible
- 🔴 **Data integrity issues** - Wrong foreign key constraints

---

### 2. **Inconsistent Naming: `clinicId` vs `tenantId`**

**Problem:**

- `users.schema.ts` uses `clinicId`
- `appointments.schema.ts` uses `tenantId`

**Should be:** Consistent `clinicId` everywhere

---

### 3. **Missing RBAC Tables in Database**

**Problem:**

RBAC schema is defined in TypeScript but not migrated to database:
- ❌ `roles` table missing
- ❌ `permissions` table missing
- ❌ `role_permissions` table missing
- ❌ `user_roles` table missing

---

### 4. **Wrong Foreign Key Constraints**

**Current migrations:**
```sql
-- ❌ WRONG - Uses cascade
ALTER TABLE "appointments" ADD CONSTRAINT ... ON DELETE cascade
ALTER TABLE "refresh_tokens" ADD CONSTRAINT ... ON DELETE cascade
```

**Should be:**
```sql
-- ✅ CORRECT - Uses restrict for explicit control
ALTER TABLE "appointments" ADD CONSTRAINT ... ON DELETE restrict
ALTER TABLE "refresh_tokens" ADD CONSTRAINT ... ON DELETE restrict
```

---

## ✅ GOOD CONFIGURATIONS

### 1. **Database Connection** (`db/index.ts`)

**Status:** ✅ **EXCELLENT**

**Strengths:**
- ✅ Uses connection pooling (max: 20)
- ✅ Proper timeout configuration
- ✅ Error handling with process exit
- ✅ Exports typed `db` instance
- ✅ Passes schema to Drizzle for type safety

**Code:**
```typescript
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,                        // ✅ Good pool size
  idleTimeoutMillis: 30000,       // ✅ 30s idle timeout
  connectionTimeoutMillis: 2000,  // ✅ 2s connection timeout
});

pool.on("error", (err: Error) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
  process.exit(-1);               // ✅ Fail fast on pool errors
});

export const db = drizzle(pool, { schema }); // ✅ Type-safe queries
```

---

### 2. **Schema Barrel** (`db/schema.ts`)

**Status:** ✅ **EXCELLENT**

**Strengths:**
- ✅ Clean barrel pattern
- ✅ Re-exports all module schemas
- ✅ Includes RBAC schema
- ✅ Clear documentation

**Code:**
```typescript
export * from "../modules/users/user.schema.js";
export * from "../modules/appointments/appointment.schema.js";
export * from "../modules/auth/auth.schema.js";
export * from "../modules/rbac/rbac.schema.js"; // ✅ RBAC included
```

---

### 3. **Drizzle Configuration** (`drizzle.config.ts`)

**Status:** ✅ **GOOD**

**Strengths:**
- ✅ Points to schema barrel
- ✅ Uses environment variable
- ✅ Proper TypeScript typing

**Code:**
```typescript
export default {
  schema: "./src/db/schema.ts",  // ✅ Correct path
  out: "./drizzle",              // ✅ Migration output
  dialect: "postgresql",         // ✅ Correct dialect
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

---

### 4. **TypeScript Schemas** (Module Schemas)

**Status:** ✅ **EXCELLENT** (but not migrated)

#### Users Schema (`users/user.schema.ts`)

**Strengths:**
- ✅ Has `clinicId` for multi-tenant support
- ✅ No `role` column (uses `user_roles` table)
- ✅ Email unique per clinic (not global)
- ✅ Proper indexes (clinic, isActive)
- ✅ Comprehensive documentation

**Code:**
```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull(), // ✅ Multi-tenant
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  emailClinicUnique: unique("users_email_clinic_unique").on(t.email, t.clinicId), // ✅
  clinicIdx: index("users_clinic_idx").on(t.clinicId), // ✅
  isActiveIdx: index("users_is_active_idx").on(t.isActive), // ✅
}));
```

#### Appointments Schema (`appointments/appointment.schema.ts`)

**Strengths:**
- ✅ Has `tenantId` (should be `clinicId`)
- ✅ Proper foreign key with `restrict`
- ✅ Comprehensive indexes
- ✅ Composite indexes for multi-tenant queries

**Issues:**
- ⚠️ Uses `tenantId` instead of `clinicId` (inconsistent)

**Code:**
```typescript
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(), // ⚠️ Should be clinicId
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }), // ✅ Correct
  // ... other fields
}, (t) => ({
  tenantIdx: index("appointments_tenant_idx").on(t.tenantId), // ✅
  tenantUserIdx: index("appointments_tenant_user_idx").on(t.tenantId, t.userId), // ✅
  // ... more indexes
}));
```

#### Auth Schema (`auth/auth.schema.ts`)

**Strengths:**
- ✅ Secure token storage (SHA-256 hash)
- ✅ Token rotation support (familyId)
- ✅ Proper foreign key with `restrict`
- ✅ Comprehensive indexes

**Code:**
```typescript
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }), // ✅ Correct
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), // ✅ Secure
  familyId: uuid("family_id").notNull(), // ✅ Token rotation
  // ... other fields
});
```

#### RBAC Schema (`rbac/rbac.schema.ts`)

**Status:** ✅ **EXCELLENT**

**Strengths:**
- ✅ Complete RBAC implementation
- ✅ 5 tables (users, roles, permissions, role_permissions, user_roles)
- ✅ Global and clinic-specific roles
- ✅ Fixed permissions (seeded)
- ✅ Many-to-many relationships
- ✅ Proper foreign key constraints
- ✅ Comprehensive indexes

**Tables:**
1. `roles` - Global (clinicId = NULL) and clinic-specific roles
2. `permissions` - Fixed permissions (seeded)
3. `role_permissions` - Many-to-many (role → permissions)
4. `user_roles` - Many-to-many (user → roles)

---

## 📊 Schema Comparison

### Current Database vs TypeScript Schema

| Table | Database (Migrated) | TypeScript Schema | Status |
|-------|-------------------|------------------|--------|
| **users** | ❌ Old schema | ✅ New schema | 🔴 MISMATCH |
| - clinicId | ❌ Missing | ✅ Present | 🔴 CRITICAL |
| - role column | ✅ Present (enum) | ❌ Removed | 🔴 CRITICAL |
| - email unique | ✅ Global | ✅ Per clinic | 🔴 CRITICAL |
| **appointments** | ❌ Old schema | ✅ New schema | 🔴 MISMATCH |
| - tenantId/clinicId | ❌ Missing | ✅ Present | 🔴 CRITICAL |
| - FK constraint | ❌ cascade | ✅ restrict | 🔴 CRITICAL |
| **refresh_tokens** | ✅ Migrated | ✅ Matches | ⚠️ FK wrong |
| - FK constraint | ❌ cascade | ✅ restrict | ⚠️ MISMATCH |
| **roles** | ❌ Not migrated | ✅ Defined | 🔴 MISSING |
| **permissions** | ❌ Not migrated | ✅ Defined | 🔴 MISSING |
| **role_permissions** | ❌ Not migrated | ✅ Defined | 🔴 MISSING |
| **user_roles** | ❌ Not migrated | ✅ Defined | 🔴 MISSING |

---

## 🔧 REQUIRED ACTIONS

### Priority 1: Generate New Migration (CRITICAL)

The TypeScript schemas are correct, but the database is out of sync.

**Steps:**

1. **Generate migration from current schemas:**
   ```bash
   cd api
   npm run db:generate
   ```

   This will create a new migration file with:
   - Add `clinic_id` to `users` table
   - Remove `role` column from `users` table
   - Drop `user_role` enum
   - Update `users_email_unique` constraint to `users_email_clinic_unique`
   - Add `tenant_id` to `appointments` table
   - Create `roles` table
   - Create `permissions` table
   - Create `role_permissions` table
   - Create `user_roles` table
   - Update foreign key constraints to use `restrict`

2. **Review the generated migration:**
   ```bash
   cat drizzle/0002_*.sql
   ```

3. **Apply migration:**
   ```bash
   npm run db:migrate
   ```

4. **Seed RBAC data:**
   ```bash
   npm run seed:rbac
   ```

---

### Priority 2: Fix Naming Inconsistency

**Change `tenantId` to `clinicId` in appointments schema:**

```typescript
// api/src/modules/appointments/appointment.schema.ts

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull(), // ✅ Changed from tenantId
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  // ... rest of fields
}, (t) => ({
  clinicIdx: index("appointments_clinic_idx").on(t.clinicId), // ✅ Updated
  clinicUserIdx: index("appointments_clinic_user_idx").on(t.clinicId, t.userId), // ✅
  clinicScheduledIdx: index("appointments_clinic_scheduled_idx").on(t.clinicId, t.scheduledAt), // ✅
  // ... rest of indexes
}));
```

Then regenerate migration:
```bash
npm run db:generate
```

---

### Priority 3: Update Repositories

After migration, update all repositories to use the new schema:

1. **User Repository:**
   - Remove `role` field references
   - Use `clinicId` instead of `tenantId`

2. **Appointment Repository:**
   - Use `clinicId` instead of `tenantId`

3. **Auth Repository:**
   - Verify FK constraint behavior

---

### Priority 4: Data Migration Strategy

**If you have existing data in the database:**

1. **Backup database:**
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Create migration script:**
   ```sql
   -- Add clinicId column (nullable first)
   ALTER TABLE users ADD COLUMN clinic_id UUID;
   
   -- Set default clinic for existing users
   UPDATE users SET clinic_id = '00000000-0000-0000-0000-000000000001';
   
   -- Make clinicId NOT NULL
   ALTER TABLE users ALTER COLUMN clinic_id SET NOT NULL;
   
   -- Migrate role data to user_roles table
   INSERT INTO user_roles (user_id, role_id)
   SELECT u.id, r.id
   FROM users u
   JOIN roles r ON r.name = CASE
     WHEN u.role = 'admin' THEN 'Super Admin'
     WHEN u.role = 'user' THEN 'Patient'
     ELSE 'Patient'
   END;
   
   -- Drop old role column
   ALTER TABLE users DROP COLUMN role;
   ```

3. **Test migration on staging first**

---

## 📝 MIGRATION CHECKLIST

### Pre-Migration
- [ ] Backup production database
- [ ] Test migration on local database
- [ ] Test migration on staging database
- [ ] Review generated SQL migration file
- [ ] Verify all indexes are created
- [ ] Verify foreign key constraints

### Migration
- [ ] Fix `tenantId` → `clinicId` in appointments schema
- [ ] Generate new migration: `npm run db:generate`
- [ ] Review migration file
- [ ] Apply migration: `npm run db:migrate`
- [ ] Seed RBAC data: `npm run seed:rbac`

### Post-Migration
- [ ] Verify all tables exist
- [ ] Verify all indexes exist
- [ ] Verify foreign key constraints
- [ ] Test user creation with RBAC
- [ ] Test multi-tenant isolation
- [ ] Update all repositories
- [ ] Update all services
- [ ] Run integration tests

---

## 🎯 RECOMMENDED MIGRATION ORDER

### Phase 1: Schema Fixes (Local)
1. ✅ Fix `tenantId` → `clinicId` in appointments schema
2. ✅ Generate migration: `npm run db:generate`
3. ✅ Review generated SQL
4. ✅ Apply migration: `npm run db:migrate`
5. ✅ Seed RBAC: `npm run seed:rbac`

### Phase 2: Code Updates
1. ✅ Update repositories to use new schema
2. ✅ Update services to use RBAC
3. ✅ Update controllers to pass RBAC context
4. ✅ Update routes to use RBAC middleware

### Phase 3: Testing
1. ✅ Test user CRUD with multi-tenant isolation
2. ✅ Test RBAC authorization
3. ✅ Test appointment CRUD with multi-tenant isolation
4. ✅ Test foreign key constraints
5. ✅ Test data integrity

### Phase 4: Production Deployment
1. ✅ Backup production database
2. ✅ Run migration on production
3. ✅ Seed RBAC data
4. ✅ Deploy updated code
5. ✅ Monitor for errors

---

## 📚 SCHEMA DOCUMENTATION

### Users Table (After Migration)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,                    -- Multi-tenant
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT users_email_clinic_unique UNIQUE (email, clinic_id)
);

CREATE INDEX users_clinic_idx ON users(clinic_id);
CREATE INDEX users_is_active_idx ON users(is_active);
```

### Appointments Table (After Migration)

```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,                    -- Multi-tenant
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60 NOT NULL,
  status appointment_status DEFAULT 'pending' NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX appointments_clinic_idx ON appointments(clinic_id);
CREATE INDEX appointments_user_id_idx ON appointments(user_id);
CREATE INDEX appointments_clinic_user_idx ON appointments(clinic_id, user_id);
CREATE INDEX appointments_clinic_scheduled_idx ON appointments(clinic_id, scheduled_at);
```

### RBAC Tables (After Migration)

```sql
-- Roles (global and clinic-specific)
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  clinic_id UUID,  -- NULL = global, UUID = clinic-specific
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT roles_name_clinic_unique UNIQUE (name, clinic_id)
);

-- Permissions (fixed, seeded)
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,  -- e.g., "users:create"
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  category VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Role Permissions (many-to-many)
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  PRIMARY KEY (role_id, permission_id)
);

-- User Roles (many-to-many)
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  PRIMARY KEY (user_id, role_id)
);
```

---

## ✅ SUMMARY

**Database Configuration:** 8/10

**Strengths:**
- ✅ Excellent connection pooling
- ✅ Clean schema barrel pattern
- ✅ Production-ready TypeScript schemas
- ✅ Comprehensive RBAC schema
- ✅ Proper indexes and constraints

**Critical Issues:**
- 🔴 Schema-migration mismatch (TypeScript vs Database)
- 🔴 RBAC tables not migrated
- 🔴 Multi-tenant columns missing in database
- 🔴 Wrong foreign key constraints (cascade vs restrict)
- ⚠️ Inconsistent naming (tenantId vs clinicId)

**Action Required:**
- 🔴 **CRITICAL:** Generate and apply new migration
- 🔴 **CRITICAL:** Fix naming inconsistency
- 🔴 **CRITICAL:** Seed RBAC data
- 🟡 **IMPORTANT:** Update all repositories and services
- 🟢 **NICE TO HAVE:** Add migration rollback scripts

---

**Status:** ⚠️ **REQUIRES IMMEDIATE ACTION**

The TypeScript schemas are production-ready, but the database is still using the old schema. A new migration must be generated and applied before the application can run.
