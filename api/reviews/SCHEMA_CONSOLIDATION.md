# Schema Consolidation - Users Table

## ✅ Issue Resolved

**Problem:** Duplicate `users` table definition in two places:
- `api/src/modules/users/user.schema.ts` (old approach with single role enum)
- `api/src/modules/rbac/rbac.schema.ts` (new RBAC approach)

**Solution:** Consolidated into a single `users` table that supports the RBAC system.

---

## 🔄 Changes Made

### 1. Updated `users` Table (user.schema.ts)

**Removed:**
- ❌ `userRoleEnum` - Single role enum (admin, doctor, patient)
- ❌ `role` column - Single role per user
- ❌ `tenantId` - Renamed to `clinicId` for consistency

**Added:**
- ✅ `clinicId` - Multi-tenant support (consistent naming)
- ✅ `name` field - User's full name
- ✅ Unique constraint on `(email, clinicId)` - Email unique per clinic

**Result:**
```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

### 2. Updated RBAC Schema (rbac.schema.ts)

**Removed:**
- ❌ Duplicate `users` table definition

**Added:**
- ✅ Import `users` from `../users/user.schema.js`
- ✅ Re-export `users`, `User`, `NewUser` types

**Result:**
```typescript
import { users } from "../users/user.schema.js";

// Use imported users table in foreign keys
export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // ...
});

// Re-export for convenience
export { users, type User, type NewUser } from "../users/user.schema.js";
```

### 3. Updated Schema Barrel (db/schema.ts)

**Added:**
- ✅ Export RBAC schema: `export * from "../modules/rbac/rbac.schema.js";`

---

## 📊 Final Schema Structure

### Users Table (Single Source of Truth)
```
users
├── id (uuid, PK)
├── clinicId (uuid, NOT NULL) ← Multi-tenant
├── name (varchar)
├── email (varchar)
├── passwordHash (varchar)
├── isActive (boolean)
├── createdAt (timestamp)
└── updatedAt (timestamp)

UNIQUE: (email, clinicId)
INDEX: (clinicId)
INDEX: (isActive)
```

### RBAC Tables

#### Roles
```
roles
├── id (uuid, PK)
├── name (varchar)
├── description (varchar)
├── clinicId (uuid, NULLABLE) ← NULL = global, UUID = clinic-specific
├── createdAt (timestamp)
└── updatedAt (timestamp)

UNIQUE: (name, clinicId)
INDEX: (clinicId)
```

#### Permissions (Fixed)
```
permissions
├── id (uuid, PK)
├── key (varchar, UNIQUE) ← e.g., "users:create"
├── name (varchar)
├── description (varchar)
├── category (varchar)
└── createdAt (timestamp)

UNIQUE: (key)
INDEX: (category)
```

#### User Roles (Many-to-Many)
```
user_roles
├── userId (uuid, FK → users.id, CASCADE)
├── roleId (uuid, FK → roles.id, RESTRICT)
├── assignedAt (timestamp)
└── assignedBy (uuid, FK → users.id, SET NULL)

PRIMARY KEY: (userId, roleId)
INDEX: (userId)
INDEX: (roleId)
```

#### Role Permissions (Many-to-Many)
```
role_permissions
├── roleId (uuid, FK → roles.id, CASCADE)
├── permissionId (uuid, FK → permissions.id, RESTRICT)
└── createdAt (timestamp)

PRIMARY KEY: (roleId, permissionId)
INDEX: (roleId)
INDEX: (permissionId)
```

---

## 🔄 Migration Path

### From Old Schema (Single Role)

**Old:**
```sql
users
├── role (enum: admin, doctor, patient) ← Single role
└── tenantId (uuid)
```

**New:**
```sql
users
├── clinicId (uuid) ← Renamed from tenantId
└── (no role column)

user_roles ← New table
├── userId
└── roleId ← Multiple roles per user
```

### Migration Steps

1. **Rename column:**
   ```sql
   ALTER TABLE users RENAME COLUMN tenant_id TO clinic_id;
   ```

2. **Drop old role column:**
   ```sql
   ALTER TABLE users DROP COLUMN role;
   ```

3. **Create RBAC tables:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Seed permissions and roles:**
   ```bash
   npm run seed:rbac
   ```

5. **Migrate existing user roles:**
   ```sql
   -- For each user with old role, assign corresponding new role
   INSERT INTO user_roles (user_id, role_id)
   SELECT u.id, r.id
   FROM users u
   JOIN roles r ON r.name = 'Patient' -- or appropriate role
   WHERE u.id NOT IN (SELECT user_id FROM user_roles);
   ```

---

## ✅ Benefits of Consolidation

### 1. Single Source of Truth
- ✅ One `users` table definition
- ✅ No duplication or conflicts
- ✅ Easier to maintain

### 2. Multiple Roles Per User
- ✅ Users can have multiple roles (Doctor + Admin)
- ✅ Permissions aggregated from all roles
- ✅ More flexible than single role enum

### 3. Consistent Naming
- ✅ `clinicId` everywhere (not mixed with `tenantId`)
- ✅ Clear multi-tenant architecture
- ✅ Better code readability

### 4. Scalable RBAC
- ✅ Fixed permissions (seeded)
- ✅ Dynamic roles (global + clinic-specific)
- ✅ Production-ready architecture

---

## 📝 Usage After Consolidation

### Import Users Table

```typescript
// ✅ CORRECT - Import from users module
import { users, type User } from "../modules/users/user.schema.js";

// ✅ ALSO CORRECT - Import from RBAC module (re-exported)
import { users, type User } from "../modules/rbac/rbac.schema.js";
```

### Query Users with Roles

```typescript
import { users, userRoles, roles } from "../modules/rbac/rbac.schema.js";

// Get user with all roles
const result = await db
  .select({
    user: users,
    role: roles,
  })
  .from(users)
  .leftJoin(userRoles, eq(userRoles.userId, users.id))
  .leftJoin(roles, eq(userRoles.roleId, roles.id))
  .where(eq(users.id, userId));
```

### Assign Multiple Roles

```typescript
// User can be both Doctor and Receptionist
await db.insert(userRoles).values([
  { userId, roleId: doctorRoleId },
  { userId, roleId: receptionistRoleId },
]);
```

---

## 🎯 Summary

**Before:**
- ❌ Duplicate `users` table in 2 files
- ❌ Single role per user (enum)
- ❌ Mixed naming (`tenantId` vs `clinicId`)

**After:**
- ✅ Single `users` table (user.schema.ts)
- ✅ Multiple roles per user (user_roles table)
- ✅ Consistent naming (`clinicId` everywhere)
- ✅ Production-ready RBAC system

**Status:** ✅ Schema consolidated and ready for production
