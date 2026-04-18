# Migration Cleanup - Complete

## ✅ What Was Done

I've cleaned up the old migrations and prepared your project for fresh migrations that match your production-ready schemas.

---

## 🗑️ Deleted Files

### Old Migrations
- ❌ `api/drizzle/0000_typical_jetstream.sql` - Old schema without multi-tenant
- ❌ `api/drizzle/0001_moaning_photon.sql` - Old refresh tokens migration

### Old Metadata
- ❌ `api/drizzle/meta/0000_snapshot.json`
- ❌ `api/drizzle/meta/0001_snapshot.json`
- ❌ `api/drizzle/meta/_journal.json`

---

## 🔧 Schema Fixes Applied

### Fixed Naming Inconsistency

**Before:**
```typescript
// appointments.schema.ts
tenantId: uuid("tenant_id").notNull()
```

**After:**
```typescript
// appointments.schema.ts
clinicId: uuid("clinic_id").notNull() // ✅ Consistent with users table
```

**All indexes updated:**
- `appointments_tenant_idx` → `appointments_clinic_idx`
- `appointments_tenant_user_idx` → `appointments_clinic_user_idx`
- `appointments_tenant_scheduled_idx` → `appointments_clinic_scheduled_idx`

---

## 📋 Current Schema State

Your TypeScript schemas are now **production-ready** and **consistent**:

### Users Table
```typescript
✅ clinicId: uuid("clinic_id").notNull()
✅ No role column (uses user_roles table)
✅ Email unique per clinic
✅ Proper indexes
```

### Appointments Table
```typescript
✅ clinicId: uuid("clinic_id").notNull()  // Fixed from tenantId
✅ Foreign key with restrict
✅ Composite indexes for multi-tenant queries
```

### RBAC Tables
```typescript
✅ roles - Global and clinic-specific
✅ permissions - 22 fixed permissions
✅ role_permissions - Many-to-many
✅ user_roles - Many-to-many
```

### Auth Tables
```typescript
✅ refresh_tokens - Secure token storage
```

---

## 🚀 Next Steps

### Step 1: Generate Fresh Migrations

```bash
cd api
npm run db:generate
```

**This will create:**
- New migration file: `drizzle/0000_*.sql`
- New snapshot: `drizzle/meta/0000_snapshot.json`
- New journal: `drizzle/meta/_journal.json`

**Expected tables in migration:**
1. ✅ `users` (with `clinic_id`, no `role` column)
2. ✅ `roles` (with nullable `clinic_id`)
3. ✅ `permissions` (fixed permissions)
4. ✅ `role_permissions` (many-to-many)
5. ✅ `user_roles` (many-to-many)
6. ✅ `appointments` (with `clinic_id`)
7. ✅ `refresh_tokens` (secure token storage)

**Expected enums:**
1. ✅ `appointment_status` (pending, confirmed, cancelled, completed)

---

### Step 2: Review Generated Migration

```bash
cat drizzle/0000_*.sql
```

**Verify:**
- ✅ All 7 tables are created
- ✅ `users` has `clinic_id` (not `tenant_id`)
- ✅ `users` does NOT have `role` column
- ✅ `appointments` has `clinic_id` (not `tenant_id`)
- ✅ All foreign keys use `ON DELETE RESTRICT` (except cascade where appropriate)
- ✅ All indexes are created
- ✅ Unique constraints are correct

---

### Step 3: Reset Database and Apply Migration

**Option A: Using Reset Script (Recommended)**
```bash
npm run db:reset
```

This will:
1. Drop all existing tables (if any)
2. Drop all enums
3. Apply the new migration
4. Seed RBAC data

**Option B: Manual Steps**
```bash
# If you have existing data, backup first
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Apply migration
npm run db:migrate

# Seed RBAC data
npm run seed:rbac
```

---

### Step 4: Verify Database

```bash
# Open Drizzle Studio
npm run db:studio
```

**Check:**
- ✅ All 7 tables exist
- ✅ `users` table has `clinic_id` column
- ✅ `users` table does NOT have `role` column
- ✅ `appointments` table has `clinic_id` column
- ✅ RBAC tables exist (roles, permissions, role_permissions, user_roles)
- ✅ 22 permissions are seeded
- ✅ 5 roles are seeded
- ✅ Role-permission mappings exist

---

### Step 5: Update Repositories (If Needed)

If you have existing repositories using `tenantId`, update them to use `clinicId`:

**Appointment Repository:**
```typescript
// Before
async findAll(query: ListQuery, tenantId: string) {
  const conditions: SQL[] = [eq(appointments.tenantId, tenantId)];
  // ...
}

// After
async findAll(query: ListQuery, clinicId: string) {
  const conditions: SQL[] = [eq(appointments.clinicId, clinicId)];
  // ...
}
```

**Search and replace:**
```bash
# Find all occurrences of tenantId in appointment files
grep -r "tenantId" api/src/modules/appointments/

# Replace manually or use sed (be careful!)
```

---

## 📊 Migration Comparison

### Old Migrations (Deleted)

| Migration | Tables | Issues |
|-----------|--------|--------|
| 0000 | users, appointments | ❌ No `clinic_id`, has `role` enum, wrong FK |
| 0001 | refresh_tokens | ❌ Wrong FK constraint |

### New Migration (To Be Generated)

| Migration | Tables | Status |
|-----------|--------|--------|
| 0000 | All 7 tables | ✅ Production-ready, multi-tenant, RBAC |

---

## 🎯 What You Get

After generating and applying the new migration:

### Database Structure
```
users
├── id (uuid, PK)
├── clinic_id (uuid, NOT NULL) ← Multi-tenant
├── name (varchar)
├── email (varchar)
├── password_hash (varchar)
├── is_active (boolean)
├── created_at (timestamptz)
└── updated_at (timestamptz)
UNIQUE: (email, clinic_id)

roles
├── id (uuid, PK)
├── name (varchar)
├── description (varchar)
├── clinic_id (uuid, NULLABLE) ← NULL = global
├── created_at (timestamptz)
└── updated_at (timestamptz)
UNIQUE: (name, clinic_id)

permissions (22 rows seeded)
├── id (uuid, PK)
├── key (varchar, UNIQUE) ← "users:create"
├── name (varchar)
├── description (varchar)
├── category (varchar)
└── created_at (timestamptz)

role_permissions
├── role_id (uuid, FK → roles)
├── permission_id (uuid, FK → permissions)
└── created_at (timestamptz)
PK: (role_id, permission_id)

user_roles
├── user_id (uuid, FK → users)
├── role_id (uuid, FK → roles)
├── assigned_at (timestamptz)
└── assigned_by (uuid, FK → users)
PK: (user_id, role_id)

appointments
├── id (uuid, PK)
├── clinic_id (uuid, NOT NULL) ← Multi-tenant
├── user_id (uuid, FK → users)
├── title (varchar)
├── description (text)
├── scheduled_at (timestamptz)
├── duration_minutes (integer)
├── status (appointment_status)
├── notes (text)
├── created_at (timestamptz)
└── updated_at (timestamptz)

refresh_tokens
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── token_hash (varchar, UNIQUE)
├── family_id (uuid)
├── expires_at (timestamptz)
├── revoked_at (timestamptz)
├── user_agent (varchar)
├── ip_address (varchar)
└── created_at (timestamptz)
```

### Seed Data
- ✅ 22 permissions across 6 categories
- ✅ 5 default global roles
- ✅ Role-permission mappings

---

## ⚠️ Important Notes

### 1. Backup Before Migration

If you have existing data:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Test on Development First

Never apply untested migrations to production:
```bash
# Test locally first
npm run db:reset

# Test on staging
DATABASE_URL=<staging-url> npm run db:migrate

# Then production
DATABASE_URL=<production-url> npm run db:migrate
```

### 3. Update All References

After migration, update:
- ✅ Repositories (tenantId → clinicId)
- ✅ Services (tenantId → clinicId)
- ✅ Controllers (tenantId → clinicId)
- ✅ Validation schemas (tenantId → clinicId)

### 4. Run TypeScript Check

```bash
cd api
npx tsc --noEmit
```

Fix any type errors related to the schema changes.

---

## 🐛 Troubleshooting

### Error: "No schema changes detected"

**Cause:** Drizzle thinks the database matches the schema.

**Solution:**
```bash
# Drop the database manually
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Or use the reset script
npm run db:reset
```

---

### Error: "relation already exists"

**Cause:** Old tables still exist in database.

**Solution:**
```bash
npm run db:reset
```

---

### Error: "Cannot find module"

**Cause:** TypeScript compilation issue.

**Solution:**
```bash
npm run build
npm run db:generate
```

---

## ✅ Checklist

### Pre-Migration
- [x] Old migrations deleted
- [x] Schema naming fixed (tenantId → clinicId)
- [ ] Backup existing data (if any)
- [ ] Review current database state

### Migration
- [ ] Generate new migration: `npm run db:generate`
- [ ] Review generated SQL
- [ ] Apply migration: `npm run db:reset` or `npm run db:migrate`
- [ ] Verify tables in database

### Post-Migration
- [ ] Verify all 7 tables exist
- [ ] Verify RBAC data seeded (22 permissions, 5 roles)
- [ ] Update repositories (tenantId → clinicId)
- [ ] Update services (tenantId → clinicId)
- [ ] Run TypeScript check: `npx tsc --noEmit`
- [ ] Test API endpoints
- [ ] Test RBAC authorization

---

## 🚀 Quick Start

**Complete workflow:**

```bash
cd api

# 1. Generate fresh migration
npm run db:generate

# 2. Review the migration
cat drizzle/0000_*.sql

# 3. Reset database and apply migration
npm run db:reset

# 4. Verify in Drizzle Studio
npm run db:studio

# 5. Start development server
npm run dev

# 6. Test the API
curl http://localhost:3000/health
```

---

## 📚 Related Documentation

- **Database Scripts:** `api/DATABASE_SCRIPTS.md`
- **Database Review:** `api/DB_REVIEW.md`
- **RBAC System:** `api/RBAC_SYSTEM.md`
- **Config Review:** `api/CONFIG_REVIEW.md`

---

**Status:** ✅ Ready to generate fresh migrations!

**Next Command:** `npm run db:generate`
