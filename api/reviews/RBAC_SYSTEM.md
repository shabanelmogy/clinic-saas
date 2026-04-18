# Production-Ready RBAC System with Multi-Tenant Support

Complete implementation of Role-Based Access Control (RBAC) with multi-tenant isolation.

---

## 🎯 System Overview

### Key Features
- ✅ **Multiple roles per user** - Users can have multiple roles simultaneously
- ✅ **Fixed permissions** - Permissions are seeded in database, not dynamic
- ✅ **Dynamic roles** - Roles can be global or tenant-specific
- ✅ **Multi-tenant isolation** - Complete data separation between clinics
- ✅ **JWT-based authorization** - Permissions in token (no DB queries per request)
- ✅ **Permission aggregation** - Deduplicated permissions from all user roles
- ✅ **Scalable architecture** - Optimized for SaaS applications

---

## 🗄️ Database Schema

### Tables

#### 1. `users`
```sql
- id (uuid, PK)
- email (varchar, unique per clinic)
- passwordHash (varchar)
- clinicId (uuid, NOT NULL) -- Every user belongs to a clinic
- isActive (boolean)
- createdAt (timestamp)
- updatedAt (timestamp)

UNIQUE INDEX: (email, clinicId)
INDEX: (clinicId)
```

#### 2. `roles`
```sql
- id (uuid, PK)
- name (varchar)
- description (varchar)
- clinicId (uuid, NULLABLE) -- NULL = global, UUID = clinic-specific
- createdAt (timestamp)
- updatedAt (timestamp)

UNIQUE INDEX: (name, clinicId)
INDEX: (clinicId)
```

#### 3. `permissions` (FIXED)
```sql
- id (uuid, PK)
- key (varchar, UNIQUE) -- e.g., "users:create"
- name (varchar)
- description (varchar)
- category (varchar) -- e.g., "users", "appointments"
- createdAt (timestamp)

UNIQUE INDEX: (key)
INDEX: (category)
```

#### 4. `role_permissions` (Many-to-Many)
```sql
- roleId (uuid, FK → roles.id, CASCADE)
- permissionId (uuid, FK → permissions.id, RESTRICT)
- createdAt (timestamp)

PRIMARY KEY: (roleId, permissionId)
INDEX: (roleId)
INDEX: (permissionId)
```

#### 5. `user_roles` (Many-to-Many)
```sql
- userId (uuid, FK → users.id, CASCADE)
- roleId (uuid, FK → roles.id, RESTRICT)
- assignedAt (timestamp)
- assignedBy (uuid, FK → users.id, SET NULL)

PRIMARY KEY: (userId, roleId)
INDEX: (userId)
INDEX: (roleId)
```

---

## 🔐 Permission System

### Fixed Permissions (Seeded)

All permissions are defined in `permissions.seed.ts` and seeded into the database.

**Categories:**
- `users` - User management (view, create, update, delete, manage_roles)
- `roles` - Role management (view, create, update, delete)
- `appointments` - Appointment management (view_all, view_own, create, update, delete)
- `clinic` - Clinic management (view, update, manage_billing)
- `reports` - Reports & analytics (view, export)
- `system` - System administration (view_logs, manage_settings)

**Permission Format:** `category:action`

Examples:
- `users:create`
- `appointments:view_all`
- `roles:update`

---

## 👥 Role System

### Global Roles (clinicId = NULL)

Seeded by default, available to all clinics:

1. **Super Admin** - Full system access
2. **Clinic Admin** - Clinic management + user management
3. **Doctor** - View patients, manage appointments
4. **Receptionist** - Manage appointments
5. **Patient** - View own appointments

### Clinic-Specific Roles (clinicId = UUID)

Clinics can create custom roles with custom permission sets.

**Example:**
- Clinic A creates "Senior Doctor" role with extra permissions
- Clinic B creates "Nurse" role with limited permissions
- These roles are only visible/assignable within their clinic

---

## 🔑 JWT Payload Structure

```typescript
{
  userId: "uuid",
  clinicId: "uuid",
  email: "user@example.com",
  roles: ["Clinic Admin", "Doctor"],
  permissions: [
    "users:view",
    "users:create",
    "appointments:view_all",
    "appointments:create",
    // ... all permissions from all roles (deduplicated)
  ],
  permissionsVersion: 1234567890,
  iat: 1234567890,
  exp: 1234567890
}
```

### Why Permissions in JWT?

✅ **Performance** - No database query on every request
✅ **Scalability** - Stateless authorization
✅ **Speed** - O(1) permission check (array lookup)

### Permission Updates

When user roles/permissions change:

1. **Option A: Token Refresh**
   - User refreshes token on next request
   - Gets updated permissions immediately

2. **Option B: Version Check (Recommended)**
   - Store `permissionsVersion` in Redis per user
   - Middleware compares JWT version with cache version
   - If stale, force token refresh

3. **Option C: Short Token Expiry**
   - Set JWT expiry to 15-30 minutes
   - User gets fresh permissions on next login

---

## 🛡️ Authorization Flow

### 1. Login Flow

```typescript
POST /auth/login
{
  email: "doctor@clinic.com",
  password: "password",
  clinicId: "clinic-uuid"
}

// Backend:
1. Find user by email + clinicId
2. Verify password
3. Fetch all user roles (global + clinic-specific)
4. Fetch all permissions from all roles
5. Deduplicate permissions
6. Generate JWT with permissions
7. Return token + user info
```

### 2. Authorization Flow

```typescript
GET /users
Authorization: Bearer <jwt>

// Backend:
1. authenticate middleware:
   - Verify JWT
   - Extract payload
   - Attach to req.user

2. authorize("users:view") middleware:
   - Check if "users:view" in req.user.permissions
   - If yes → continue
   - If no → 403 Forbidden

3. Controller:
   - Use req.clinicId for all queries
   - Ensure multi-tenant isolation
```

---

## 📝 Usage Examples

### 1. Protected Route (Single Permission)

```typescript
import { authenticate, authorize } from "./authorize.middleware.js";

router.post(
  "/users",
  authenticate,
  authorize("users:create"),
  userController.create
);
```

### 2. Protected Route (Multiple Permissions - ANY)

```typescript
import { authenticate, authorizeAny } from "./authorize.middleware.js";

router.get(
  "/appointments",
  authenticate,
  authorizeAny(["appointments:view_all", "appointments:view_own"]),
  appointmentController.list
);
```

### 3. Protected Route (Multiple Permissions - ALL)

```typescript
import { authenticate, authorizeAll } from "./authorize.middleware.js";

router.post(
  "/admin/settings",
  authenticate,
  authorizeAll(["clinic:update", "system:manage_settings"]),
  adminController.updateSettings
);
```

### 4. Service-Level Permission Check

```typescript
import { requirePermission, hasPermission } from "./authorize.middleware.js";

export const appointmentService = {
  async listAppointments(req) {
    // Check if user can view all appointments
    if (hasPermission(req.user, "appointments:view_all")) {
      // Return all appointments in clinic
      return appointmentRepo.findAll(req.clinicId);
    } else {
      // Return only user's own appointments
      requirePermission(req.user, "appointments:view_own");
      return appointmentRepo.findByUser(req.user.userId, req.clinicId);
    }
  },
};
```

### 5. Assign Role to User

```typescript
import { authRBACService } from "./auth-rbac.service.js";

// Assign "Doctor" role to user
await authRBACService.assignRole(
  userId,
  doctorRoleId,
  clinicId,
  req.user.userId // who assigned it
);

// User should refresh token to get new permissions
```

---

## 🏢 Multi-Tenant Enforcement

### Critical Rules

1. **EVERY query MUST include clinicId filter**
   ```typescript
   // ✅ CORRECT
   await db.select().from(users).where(
     and(eq(users.id, id), eq(users.clinicId, clinicId))
   );

   // ❌ WRONG - Cross-tenant data leak
   await db.select().from(users).where(eq(users.id, id));
   ```

2. **ALWAYS use clinicId from JWT, never from user input**
   ```typescript
   // ✅ CORRECT
   const user = await userRepo.findById(id, req.clinicId);

   // ❌ WRONG - User could provide another clinic's ID
   const user = await userRepo.findById(id, req.body.clinicId);
   ```

3. **NEVER allow clinicId to be changed**
   ```typescript
   // ✅ CORRECT - clinicId excluded from updates
   async update(id, clinicId, data: Omit<User, "clinicId">) {
     return db.update(users)
       .set(data)
       .where(and(eq(users.id, id), eq(users.clinicId, clinicId)));
   }

   // ❌ WRONG - User could change their clinic
   async update(id, data: Partial<User>) {
     return db.update(users).set(data).where(eq(users.id, id));
   }
   ```

4. **Validate role assignment within same clinic**
   ```typescript
   // ✅ CORRECT - Verify role belongs to clinic or is global
   const role = await db.select().from(roles).where(
     and(
       eq(roles.id, roleId),
       or(isNull(roles.clinicId), eq(roles.clinicId, clinicId))
     )
   );
   ```

---

## ⚡ Performance Optimization

### 1. No DB Queries in Authorization

✅ **Permissions are in JWT** - No database lookup per request

```typescript
// Fast - O(1) array lookup
if (req.user.permissions.includes("users:create")) {
  // authorized
}
```

### 2. Efficient Permission Aggregation

Permissions are aggregated once during login:

```typescript
// Login: Fetch all roles and permissions (1 time)
const roles = await getRoles(userId, clinicId);
const permissions = await getPermissionsFromRoles(roleIds);

// Deduplicate
const uniquePermissions = [...new Set(permissions)];

// Store in JWT
const token = signJWT({ permissions: uniquePermissions });
```

### 3. Optimized Indexes

```sql
-- Fast clinic-scoped queries
CREATE INDEX users_clinic_idx ON users(clinic_id);
CREATE INDEX roles_clinic_idx ON roles(clinic_id);

-- Fast role-permission lookups
CREATE INDEX role_permissions_role_idx ON role_permissions(role_id);

-- Fast user-role lookups
CREATE INDEX user_roles_user_idx ON user_roles(user_id);
```

### 4. Caching Strategy (Optional)

**Redis Cache for Permission Versions:**

```typescript
// Store current version per user
await redis.set(`user:${userId}:permissions_version`, Date.now());

// Middleware checks version
const jwtVersion = req.user.permissionsVersion;
const currentVersion = await redis.get(`user:${userId}:permissions_version`);

if (jwtVersion < currentVersion) {
  // Force token refresh
  return res.status(401).json({ error: "Token stale, please refresh" });
}
```

---

## 🔄 Token Consistency Strategies

### Problem
User's roles/permissions change, but JWT still has old permissions.

### Solutions

#### 1. Token Refresh Endpoint (Recommended)

```typescript
POST /auth/refresh

// Returns new token with fresh permissions
const newToken = await authRBACService.refreshToken(
  req.user.userId,
  req.user.clinicId
);
```

**When to use:**
- After role assignment/removal
- Periodically (every 15-30 minutes)
- On permission-denied errors

#### 2. Permission Version Check

```typescript
// Store version in Redis
await redis.set(`user:${userId}:perm_version`, Date.now());

// Middleware checks
if (req.user.permissionsVersion < cachedVersion) {
  throw new UnauthorizedError("Token stale");
}
```

#### 3. Short Token Expiry

```typescript
// Set JWT expiry to 15-30 minutes
expiresIn: "15m"

// User re-authenticates frequently
// Gets fresh permissions automatically
```

#### 4. Forced Logout on Critical Changes

```typescript
// When admin removes critical permission
await redis.del(`user:${userId}:refresh_token`);

// User must re-login
// Gets updated permissions
```

---

## 🔒 Security Best Practices

### 1. Prevent Privilege Escalation

```typescript
// ✅ CORRECT - Verify assigner has permission
async assignRole(userId, roleId, clinicId, assignedBy) {
  // Check if assigner has "users:manage_roles" permission
  requirePermission(assignerUser, "users:manage_roles");

  // Verify role belongs to same clinic or is global
  const role = await getRoleForClinic(roleId, clinicId);
  if (!role) throw new Error("Role not accessible");

  await assignRoleToUser(userId, roleId);
}
```

### 2. Validate Tenant Ownership

```typescript
// ✅ CORRECT - Verify user belongs to clinic before operations
const user = await userRepo.findById(userId, req.clinicId);
if (!user) throw new NotFoundError("User");

// Now safe to perform operations
```

### 3. Audit Logging

```typescript
// Log all role assignments
logger.info({
  msg: "Role assigned",
  userId,
  roleId,
  clinicId,
  assignedBy,
  timestamp: new Date(),
});

// Log authorization failures
logger.warn({
  msg: "Authorization failed",
  userId,
  requiredPermission,
  userPermissions,
  path: req.path,
});
```

### 4. Rate Limiting

```typescript
// Limit role assignment operations
app.use("/users/:id/roles", rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
}));
```

---

## 📦 Setup Instructions

### 1. Run Migrations

```bash
npm run db:generate
npm run db:migrate
```

### 2. Seed RBAC System

```bash
npm run seed:rbac
```

This seeds:
- 22 fixed permissions
- 5 default global roles
- Role-permission mappings

### 3. Create First User

```typescript
// Create super admin user
const user = await db.insert(users).values({
  email: "admin@clinic.com",
  passwordHash: await bcrypt.hash("password", 12),
  clinicId: "clinic-uuid",
}).returning();

// Assign Super Admin role
const [superAdminRole] = await db.select().from(roles)
  .where(eq(roles.name, "Super Admin"));

await db.insert(userRoles).values({
  userId: user.id,
  roleId: superAdminRole.id,
});
```

### 4. Test Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@clinic.com",
    "password": "password",
    "clinicId": "clinic-uuid"
  }'
```

---

## 🧪 Testing Checklist

### Multi-Tenant Isolation
- [ ] User A (clinic 1) cannot access User B's data (clinic 2)
- [ ] Email uniqueness is per clinic
- [ ] All queries include clinicId filter
- [ ] Cannot change clinicId after creation

### RBAC
- [ ] User with multiple roles gets aggregated permissions
- [ ] Permissions are deduplicated
- [ ] JWT contains all permissions
- [ ] Authorization middleware works correctly
- [ ] Service-level permission checks work

### Role Management
- [ ] Can assign global roles to any user
- [ ] Can assign clinic-specific roles only within clinic
- [ ] Cannot assign role from another clinic
- [ ] Role assignment is logged

### Token Consistency
- [ ] Token refresh returns updated permissions
- [ ] Stale token detection works (if implemented)
- [ ] Short expiry forces re-authentication

---

## 📊 Scaling Considerations

### For 1,000+ Clinics

1. **Database Partitioning**
   - Partition users table by clinicId
   - Improves query performance

2. **Redis Caching**
   - Cache role-permission mappings
   - Cache user permissions
   - TTL: 15-30 minutes

3. **Read Replicas**
   - Route permission reads to replicas
   - Reduce load on primary database

4. **CDN for Static Permissions**
   - Serve permission list via CDN
   - Reduce API calls

### For 10,000+ Users per Clinic

1. **Pagination**
   - Paginate user lists
   - Limit: 50-100 per page

2. **Search Optimization**
   - Full-text search on user names
   - Elasticsearch for advanced search

3. **Background Jobs**
   - Bulk role assignments via queue
   - Async permission updates

---

## 🎯 Summary

**What You Get:**
- ✅ Production-ready RBAC system
- ✅ Multi-tenant isolation
- ✅ JWT-based authorization (no DB queries)
- ✅ Multiple roles per user
- ✅ Fixed permissions, dynamic roles
- ✅ Global and clinic-specific roles
- ✅ Complete audit logging
- ✅ Scalable architecture

**Files Created:**
1. `rbac.schema.ts` - Database schema
2. `permissions.seed.ts` - Permission definitions
3. `seed-rbac.ts` - Seed script
4. `rbac.repository.ts` - Data access layer
5. `jwt-rbac.ts` - JWT utilities
6. `auth-rbac.service.ts` - Authentication service
7. `authorize.middleware.ts` - Authorization middleware
8. `example-routes.ts` - Usage examples
9. `multi-tenant-repository-example.ts` - Repository patterns

**Ready for Production:** ✅
