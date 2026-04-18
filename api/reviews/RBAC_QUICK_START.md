# RBAC System - Quick Start Guide

Get your production-ready RBAC system up and running in 5 minutes.

---

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
cd api
npm install
```

### 2. Run Database Migrations

```bash
npm run db:generate
npm run db:migrate
```

### 3. Seed RBAC System

```bash
npm run seed:rbac
```

This creates:
- ✅ 22 fixed permissions
- ✅ 5 default global roles (Super Admin, Clinic Admin, Doctor, Receptionist, Patient)
- ✅ Role-permission mappings

### 4. Create Test Clinic and User

```typescript
// Run this in a script or directly in DB
import { db } from "./src/db/index.js";
import { users, userRoles, roles } from "./src/modules/rbac/rbac.schema.js";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

// Create test clinic ID (or use existing)
const testClinicId = "00000000-0000-0000-0000-000000000001";

// Create super admin user
const [user] = await db.insert(users).values({
  email: "admin@test.com",
  passwordHash: await bcrypt.hash("password123", 12),
  clinicId: testClinicId,
  isActive: true,
}).returning();

// Get Super Admin role
const [superAdminRole] = await db
  .select()
  .from(roles)
  .where(eq(roles.name, "Super Admin"))
  .limit(1);

// Assign role to user
await db.insert(userRoles).values({
  userId: user.id,
  roleId: superAdminRole.id,
});

console.log("✅ Test user created:", user.email);
```

### 5. Test Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "password123",
    "clinicId": "00000000-0000-0000-0000-000000000001"
  }'
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@test.com",
    "clinicId": "00000000-0000-0000-0000-000000000001"
  },
  "roles": ["Super Admin"],
  "permissions": [
    "users:view",
    "users:create",
    "users:update",
    "users:delete",
    "users:manage_roles",
    // ... all 22 permissions
  ]
}
```

---

## 📝 Usage Examples

### 1. Protect a Route

```typescript
import { authenticate, authorize } from "./src/modules/rbac/authorize.middleware.js";

// Single permission
router.post(
  "/users",
  authenticate,
  authorize("users:create"),
  userController.create
);

// Multiple permissions (ANY)
router.get(
  "/appointments",
  authenticate,
  authorizeAny(["appointments:view_all", "appointments:view_own"]),
  appointmentController.list
);
```

### 2. Check Permission in Service

```typescript
import { hasPermission, requirePermission } from "./src/modules/rbac/authorize.middleware.js";

export const appointmentService = {
  async listAppointments(req) {
    if (hasPermission(req.user, "appointments:view_all")) {
      // Return all appointments
      return appointmentRepo.findAll(req.clinicId);
    } else {
      // Return only own appointments
      requirePermission(req.user, "appointments:view_own");
      return appointmentRepo.findByUser(req.user.userId, req.clinicId);
    }
  },
};
```

### 3. Assign Role to User

```typescript
import { authRBACService } from "./src/modules/rbac/auth-rbac.service.js";

// Assign "Doctor" role
await authRBACService.assignRole(
  userId,
  doctorRoleId,
  clinicId,
  req.user.userId // who assigned it
);

// User should refresh token
const newToken = await authRBACService.refreshToken(userId, clinicId);
```

### 4. Create Custom Role

```typescript
import { rbacRepository } from "./src/modules/rbac/rbac.repository.js";

// Get permission IDs
const permissions = await rbacRepository.getAllPermissions();
const permissionIds = permissions
  .filter(p => ["users:view", "appointments:view_all"].includes(p.key))
  .map(p => p.id);

// Create clinic-specific role
const role = await rbacRepository.createRole(
  "Senior Doctor",
  "Senior medical professional with extended permissions",
  clinicId,
  permissionIds
);
```

---

## 🔑 Available Permissions

### User Management
- `users:view` - View user list and details
- `users:create` - Create new users
- `users:update` - Update user information
- `users:delete` - Delete users
- `users:manage_roles` - Assign/remove roles

### Role Management
- `roles:view` - View roles
- `roles:create` - Create new roles
- `roles:update` - Update roles and permissions
- `roles:delete` - Delete roles

### Appointments
- `appointments:view_all` - View all appointments in clinic
- `appointments:view_own` - View only own appointments
- `appointments:create` - Create appointments
- `appointments:update` - Update appointments
- `appointments:delete` - Delete appointments

### Clinic Management
- `clinic:view` - View clinic information
- `clinic:update` - Update clinic settings
- `clinic:manage_billing` - Manage billing

### Reports
- `reports:view` - View reports
- `reports:export` - Export reports

### System
- `system:view_logs` - View system logs
- `system:manage_settings` - Manage system settings

---

## 👥 Default Roles

### Super Admin
**Permissions:** All 22 permissions
**Use Case:** System administrators

### Clinic Admin
**Permissions:** User management, appointments, clinic settings, reports
**Use Case:** Clinic managers

### Doctor
**Permissions:** View users, manage appointments, view reports
**Use Case:** Medical professionals

### Receptionist
**Permissions:** View users, manage appointments
**Use Case:** Front desk staff

### Patient
**Permissions:** View own appointments, create appointments
**Use Case:** Patients

---

## 🏢 Multi-Tenant Rules

### Critical Rules

1. **Every query MUST include clinicId**
   ```typescript
   // ✅ CORRECT
   const users = await db.select().from(users)
     .where(eq(users.clinicId, req.clinicId));

   // ❌ WRONG
   const users = await db.select().from(users);
   ```

2. **Always use clinicId from JWT**
   ```typescript
   // ✅ CORRECT
   const user = await userRepo.findById(id, req.clinicId);

   // ❌ WRONG
   const user = await userRepo.findById(id, req.body.clinicId);
   ```

3. **Never allow clinicId to be changed**
   ```typescript
   // ✅ CORRECT - clinicId excluded
   type UpdateUserInput = Omit<User, "id" | "clinicId">;

   // ❌ WRONG - clinicId can be changed
   type UpdateUserInput = Partial<User>;
   ```

---

## 🔄 Token Refresh Strategy

### When to Refresh

1. **After role assignment/removal**
   ```typescript
   await authRBACService.assignRole(...);
   const newToken = await authRBACService.refreshToken(userId, clinicId);
   ```

2. **On 401 with stale token**
   ```typescript
   // Frontend
   if (error.status === 401 && error.message.includes("stale")) {
     const newToken = await refreshToken();
     retryRequest(newToken);
   }
   ```

3. **Periodically (every 15-30 minutes)**
   ```typescript
   // Frontend
   setInterval(async () => {
     const newToken = await refreshToken();
     updateToken(newToken);
   }, 15 * 60 * 1000);
   ```

---

## 🧪 Testing

### Test Multi-Tenant Isolation

```typescript
// Create two clinics
const clinic1 = "clinic-1-uuid";
const clinic2 = "clinic-2-uuid";

// Create user in clinic 1
const user1 = await createUser("user1@clinic1.com", clinic1);

// Try to access from clinic 2 (should fail)
const result = await userRepo.findById(user1.id, clinic2);
expect(result).toBeUndefined(); // ✅ Isolated
```

### Test Permission Aggregation

```typescript
// Assign multiple roles
await assignRole(userId, doctorRoleId, clinicId);
await assignRole(userId, receptionistRoleId, clinicId);

// Login
const { permissions } = await authService.login(...);

// Should have deduplicated permissions from both roles
expect(permissions).toContain("appointments:view_all");
expect(permissions).toContain("users:view");
```

### Test Authorization

```typescript
// User with "users:view" permission
const token = generateToken({ permissions: ["users:view"] });

// Should succeed
const response = await request(app)
  .get("/users")
  .set("Authorization", `Bearer ${token}`);
expect(response.status).toBe(200);

// Should fail (no "users:create" permission)
const response2 = await request(app)
  .post("/users")
  .set("Authorization", `Bearer ${token}`);
expect(response2.status).toBe(403);
```

---

## 📊 Performance Tips

### 1. Cache Permission Mappings

```typescript
// Redis cache for role permissions
const cacheKey = `role:${roleId}:permissions`;
let permissions = await redis.get(cacheKey);

if (!permissions) {
  permissions = await rbacRepo.getRolePermissions(roleId);
  await redis.set(cacheKey, JSON.stringify(permissions), "EX", 3600);
}
```

### 2. Batch Role Assignments

```typescript
// Instead of multiple individual assignments
for (const userId of userIds) {
  await assignRole(userId, roleId, clinicId);
}

// Use batch insert
await db.insert(userRoles).values(
  userIds.map(userId => ({ userId, roleId }))
);
```

### 3. Optimize Permission Queries

```typescript
// Use indexes
CREATE INDEX user_roles_user_idx ON user_roles(user_id);
CREATE INDEX role_permissions_role_idx ON role_permissions(role_id);

// Use joins instead of multiple queries
const result = await db
  .select()
  .from(userRoles)
  .innerJoin(roles, eq(userRoles.roleId, roles.id))
  .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
  .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
  .where(eq(userRoles.userId, userId));
```

---

## 🔒 Security Checklist

- [ ] All routes have `authenticate` middleware
- [ ] Sensitive routes have `authorize` middleware
- [ ] All queries include `clinicId` filter
- [ ] `clinicId` comes from JWT, not user input
- [ ] `clinicId` cannot be changed after creation
- [ ] Role assignments are logged
- [ ] Authorization failures are logged
- [ ] Passwords are hashed with bcrypt (12 rounds)
- [ ] JWT secret is strong and stored in env
- [ ] Token expiry is reasonable (15-60 minutes)

---

## 📚 Next Steps

1. **Read Full Documentation:** `RBAC_SYSTEM.md`
2. **Review Examples:** `example-routes.ts`
3. **Implement Your Routes:** Use authorization middleware
4. **Test Thoroughly:** Multi-tenant isolation and permissions
5. **Monitor Logs:** Watch for authorization failures
6. **Optimize:** Add caching if needed

---

**Status:** ✅ Production-ready RBAC system with multi-tenant support

**Support:** See `RBAC_SYSTEM.md` for detailed documentation
