# Database Management Scripts - Summary

## ✅ What Was Added

I've created comprehensive database management scripts for your project.

---

## 📦 New Files Created

### 1. `api/scripts/reset-db.ts`
**Purpose:** Complete database reset (development only)

**Features:**
- ✅ Drops all tables and enums
- ✅ Runs all migrations
- ✅ Seeds RBAC data
- ✅ Production safety checks
- ✅ Colored console output
- ✅ Step-by-step progress

**Safety Features:**
- ❌ Refuses to run if `NODE_ENV=production`
- ❌ Refuses to run on production-like URLs (aws.com, azure.com, etc.)
- ⚠️ Shows clear warning before execution

---

### 2. `api/scripts/setup-db.ts`
**Purpose:** Initial database setup (non-destructive)

**Features:**
- ✅ Runs all migrations
- ✅ Seeds RBAC data
- ✅ Colored console output
- ✅ Helpful next steps

**Use Cases:**
- First time project setup
- After manual database drop
- Setting up new environments

---

### 3. `api/scripts/README.md`
**Purpose:** Comprehensive documentation

**Contents:**
- 📋 All available scripts explained
- 🔄 Common workflows
- 🛡️ Safety features
- 📊 Database structure
- 🐛 Troubleshooting guide
- ⚠️ Important notes

---

## 🔧 Updated Files

### 1. `api/package.json`
**Added scripts:**
```json
{
  "scripts": {
    "db:setup": "tsx scripts/setup-db.ts",   // ← NEW
    "db:reset": "tsx scripts/reset-db.ts"    // ← NEW
  }
}
```

---

### 2. `api/src/modules/rbac/seed-rbac.ts`
**Changes:**
- ✅ Exported `seedRBAC()` function for reuse
- ✅ Made it importable by other scripts
- ✅ Kept backward compatibility (can still run directly)

---

## 🚀 Usage

### Initial Setup (New Project)

```bash
cd api
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL
npm run db:setup
npm run dev
```

---

### Reset Database (Development)

```bash
cd api
npm run db:reset
```

**Output:**
```
⚠️  DATABASE RESET - ALL DATA WILL BE LOST ⚠️
ℹ Database: localhost:5432/clinic_saas

→ Step 1: Dropping all tables...
✓ All tables dropped
→ Step 2: Dropping all enums...
✓ All enums dropped
→ Step 3: Running migrations...
✓ Migrations applied
→ Step 4: Seeding RBAC data...
✓ RBAC data seeded

✨ Database reset complete!

ℹ Next steps:
  1. Start the server: npm run dev
  2. Create a test user via API or seed script
  3. Test authentication and RBAC
```

---

### Schema Changes Workflow

```bash
# 1. Modify schema
vim api/src/modules/users/user.schema.ts

# 2. Generate migration
npm run db:generate

# 3. Review migration
cat drizzle/0003_*.sql

# 4. Apply migration
npm run db:migrate

# 5. Test
npm run dev
```

---

## 📋 All Available Scripts

| Script | Purpose | Destructive? | Production Safe? |
|--------|---------|--------------|------------------|
| `npm run db:setup` | Initial setup | ❌ No | ✅ Yes |
| `npm run db:reset` | Complete reset | ⚠️ YES | ❌ No (blocked) |
| `npm run db:generate` | Generate migration | ❌ No | ✅ Yes |
| `npm run db:migrate` | Apply migrations | ⚠️ Modifies | ✅ Yes |
| `npm run db:push` | Push schema (dev) | ⚠️ Modifies | ⚠️ Dev only |
| `npm run db:studio` | Open Drizzle Studio | ❌ No | ✅ Yes |
| `npm run seed:rbac` | Seed RBAC only | ❌ No | ✅ Yes |

---

## 🛡️ Safety Features

### Production Protection

The `db:reset` script will **refuse to run** if:

1. ❌ `NODE_ENV=production`
2. ❌ DATABASE_URL contains:
   - `prod`
   - `production`
   - `aws.com`
   - `azure.com`
   - `cloud.google.com`

**Example:**
```bash
# This will be blocked
NODE_ENV=production npm run db:reset
# Output: Cannot run database reset in production environment!

# This will be blocked
DATABASE_URL=postgres://user@prod.aws.com/db npm run db:reset
# Output: Database URL appears to be a production database!
```

---

## 📊 What Gets Created

### After `npm run db:setup` or `npm run db:reset`

**Tables (7):**
1. ✅ `users` - User accounts with `clinicId`
2. ✅ `roles` - Global and clinic-specific roles
3. ✅ `permissions` - 22 fixed permissions
4. ✅ `user_roles` - Many-to-many (users ↔ roles)
5. ✅ `role_permissions` - Many-to-many (roles ↔ permissions)
6. ✅ `appointments` - Appointments with `clinicId`
7. ✅ `refresh_tokens` - JWT refresh tokens

**Enums (1):**
1. ✅ `appointment_status` - (pending, confirmed, cancelled, completed)

**Seed Data:**
- ✅ 22 permissions across 6 categories
- ✅ 5 default global roles
- ✅ Role-permission mappings

---

## 🔄 Common Workflows

### 1. Fresh Start (Development)

```bash
npm run db:reset
npm run dev
```

---

### 2. Pull Latest Changes

```bash
git pull
npm run db:migrate  # Apply new migrations
npm run dev
```

---

### 3. Add New Permission

```bash
# 1. Edit permissions.seed.ts
vim api/src/modules/rbac/permissions.seed.ts

# 2. Add permission to array and role mappings

# 3. Re-seed
npm run seed:rbac

# 4. Verify
npm run db:studio
```

---

### 4. Schema Change

```bash
# 1. Edit schema
vim api/src/modules/users/user.schema.ts

# 2. Generate migration
npm run db:generate

# 3. Review
cat drizzle/0003_*.sql

# 4. Apply
npm run db:migrate

# 5. Test
npm run dev
```

---

## 🐛 Troubleshooting

### "DATABASE_URL environment variable is not set"

```bash
cp .env.example .env
echo "DATABASE_URL=postgresql://user:password@localhost:5432/clinic_saas" >> .env
```

---

### "relation already exists"

Database already set up. Use reset:
```bash
npm run db:reset
```

---

### "Cannot run database reset in production"

This is a safety feature. Use a development database.

---

### "permission denied for schema public"

```sql
GRANT ALL ON SCHEMA public TO your_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO your_user;
```

---

## 📚 Documentation

- **Script Details:** `api/scripts/README.md`
- **RBAC System:** `api/RBAC_SYSTEM.md`
- **Database Review:** `api/DB_REVIEW.md`
- **Config Review:** `api/CONFIG_REVIEW.md`

---

## ✅ Summary

**What You Can Do Now:**

1. ✅ **Setup fresh database:** `npm run db:setup`
2. ✅ **Reset database:** `npm run db:reset`
3. ✅ **Generate migrations:** `npm run db:generate`
4. ✅ **Apply migrations:** `npm run db:migrate`
5. ✅ **Seed RBAC data:** `npm run seed:rbac`
6. ✅ **Open database UI:** `npm run db:studio`

**Safety:**
- ✅ Production-protected reset script
- ✅ Clear warnings before destructive operations
- ✅ Colored output for easy reading
- ✅ Step-by-step progress tracking

**Next Steps:**
1. Run `npm run db:reset` to set up your database
2. Start the server with `npm run dev`
3. Test the API endpoints
4. Create test users and test RBAC

---

**Status:** ✅ Database management scripts ready for use!
