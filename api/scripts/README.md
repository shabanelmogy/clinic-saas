# Database Scripts

This directory contains utility scripts for managing the database.

---

## 📋 Available Scripts

### 1. `npm run db:setup`

**Purpose:** Initial database setup

**What it does:**
- ✅ Runs all migrations
- ✅ Seeds RBAC data (22 permissions, 5 roles)
- ✅ Creates role-permission mappings

**When to use:**
- First time setting up the project
- After manually dropping the database
- Setting up a new environment (staging, testing)

**Usage:**
```bash
cd api
npm run db:setup
```

**Output:**
```
ℹ 🚀 Setting up database...
ℹ Database: localhost:5432/clinic_saas
→ Step 1: Running migrations...
✓ Migrations applied
→ Step 2: Seeding RBAC data...
✓ RBAC data seeded
✨ Database setup complete!
```

---

### 2. `npm run db:reset`

**Purpose:** Complete database reset (⚠️ DESTRUCTIVE)

**What it does:**
- ⚠️ Drops ALL tables
- ⚠️ Drops ALL enums
- ✅ Runs all migrations
- ✅ Seeds RBAC data

**When to use:**
- Development: When you need a clean slate
- Testing: Before running integration tests
- After schema changes that require a fresh start

**Safety Features:**
- ❌ Refuses to run in production (`NODE_ENV=production`)
- ❌ Refuses to run on production-like URLs (aws.com, azure.com, etc.)
- ⚠️ Shows warning before execution

**Usage:**
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
```

---

### 3. `npm run db:generate`

**Purpose:** Generate migration from schema changes

**What it does:**
- Compares TypeScript schemas with database
- Generates SQL migration file in `drizzle/` directory

**When to use:**
- After changing any `*.schema.ts` file
- Before committing schema changes

**Usage:**
```bash
cd api
npm run db:generate
```

---

### 4. `npm run db:migrate`

**Purpose:** Apply pending migrations

**What it does:**
- Runs all pending migrations in `drizzle/` directory
- Updates database to match schemas

**When to use:**
- After generating migrations
- After pulling new migrations from git
- Deploying to new environment

**Usage:**
```bash
cd api
npm run db:migrate
```

---

### 5. `npm run seed:rbac`

**Purpose:** Seed RBAC data only

**What it does:**
- Seeds 22 permissions
- Seeds 5 default roles
- Creates role-permission mappings

**When to use:**
- After adding new permissions
- After modifying role definitions
- Updating RBAC configuration

**Usage:**
```bash
cd api
npm run seed:rbac
```

---

## 🔄 Common Workflows

### Initial Setup (New Project)

```bash
# 1. Clone repository
git clone <repo-url>
cd api

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 4. Setup database
npm run db:setup

# 5. Start development server
npm run dev
```

---

### Schema Changes Workflow

```bash
# 1. Modify schema file
# Edit api/src/modules/<module>/<module>.schema.ts

# 2. Generate migration
npm run db:generate

# 3. Review generated migration
cat drizzle/0003_*.sql

# 4. Apply migration
npm run db:migrate

# 5. Test changes
npm run dev
```

---

### Fresh Start (Development)

```bash
# Reset database and start fresh
npm run db:reset

# Start development server
npm run dev
```

---

### Adding New Permissions

```bash
# 1. Edit permissions seed file
# Edit api/src/modules/rbac/permissions.seed.ts

# 2. Add new permissions to array
# Add new permissions to role mappings

# 3. Re-seed RBAC data
npm run seed:rbac

# 4. Verify in database
npm run db:studio
```

---

## 🛡️ Safety Features

### Production Protection

The `db:reset` script has multiple safety checks:

1. **Environment Check:**
   ```typescript
   if (process.env.NODE_ENV === "production") {
     // Refuses to run
   }
   ```

2. **URL Pattern Check:**
   ```typescript
   if (DATABASE_URL.includes("prod") || 
       DATABASE_URL.includes("aws.com") ||
       DATABASE_URL.includes("azure.com")) {
     // Refuses to run
   }
   ```

3. **Warning Display:**
   ```
   ⚠️  DATABASE RESET - ALL DATA WILL BE LOST ⚠️
   ```

---

## 📊 Database Structure After Setup

### Tables Created

1. **users** - User accounts with multi-tenant support
2. **roles** - Global and clinic-specific roles
3. **permissions** - Fixed permissions (22 total)
4. **user_roles** - Many-to-many (users ↔ roles)
5. **role_permissions** - Many-to-many (roles ↔ permissions)
6. **appointments** - Appointment scheduling
7. **refresh_tokens** - JWT refresh tokens

### Default Roles

1. **Super Admin** - All 22 permissions
2. **Clinic Admin** - User management, appointments, clinic settings
3. **Doctor** - View users, manage appointments
4. **Receptionist** - View users, manage appointments
5. **Patient** - View own appointments, create appointments

### Permissions (22 total)

**User Management:**
- users:view
- users:create
- users:update
- users:delete
- users:manage_roles

**Role Management:**
- roles:view
- roles:create
- roles:update
- roles:delete

**Appointments:**
- appointments:view_all
- appointments:view_own
- appointments:create
- appointments:update
- appointments:delete

**Clinic:**
- clinic:view
- clinic:update
- clinic:manage_billing

**Reports:**
- reports:view
- reports:export

**System:**
- system:view_logs
- system:manage_settings

---

## 🐛 Troubleshooting

### Error: "DATABASE_URL environment variable is not set"

**Solution:**
```bash
# Create .env file
cp .env.example .env

# Add DATABASE_URL
echo "DATABASE_URL=postgresql://user:password@localhost:5432/clinic_saas" >> .env
```

---

### Error: "relation already exists"

**Solution:**
```bash
# Database already set up, use reset instead
npm run db:reset
```

---

### Error: "Cannot run database reset in production"

**Solution:**
This is a safety feature. Use a development/local database.

---

### Error: "permission denied for schema public"

**Solution:**
```sql
-- Grant permissions to your database user
GRANT ALL ON SCHEMA public TO your_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO your_user;
```

---

## 📚 Related Documentation

- **RBAC System:** `api/RBAC_SYSTEM.md`
- **Database Review:** `api/DB_REVIEW.md`
- **Schema Documentation:** `api/src/modules/*/README.md`
- **Migration Guide:** `api/MIGRATION_GUIDE.md`

---

## ⚠️ Important Notes

1. **Never run `db:reset` in production**
   - Use `db:migrate` for production deployments
   - Always backup before migrations

2. **Always review generated migrations**
   - Check `drizzle/*.sql` files before applying
   - Verify foreign key constraints
   - Verify indexes

3. **Test migrations on staging first**
   - Never apply untested migrations to production
   - Have a rollback plan

4. **Backup before major changes**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

---

**Status:** ✅ Database scripts ready for use
