# Configuration Review - `api/src/config`

## 📋 Executive Summary

**Status:** ⚠️ **CRITICAL ISSUES FOUND**

The configuration directory has a **critical conflict** between the old hardcoded RBAC system and the new production-ready database-driven RBAC system.

---

## 🔴 CRITICAL ISSUES

### 1. **Duplicate RBAC Configuration** (BLOCKING)

**Problem:**
- ❌ `config/rbac.ts` - Old hardcoded RBAC (3 roles, 13 permissions, format: `view_users`)
- ✅ `modules/rbac/` - New database-driven RBAC (5 roles, 22 permissions, format: `users:view`)

**Impact:**
- Two conflicting RBAC systems in the codebase
- Old middleware (`middlewares/auth.middleware.ts`) uses old config
- New middleware (`modules/rbac/authorize.middleware.ts`) uses new system
- Routes are using the OLD middleware
- Permission keys don't match between systems

**Files Affected:**
- `api/src/config/rbac.ts` - ❌ DELETED (conflicting config)
- `api/src/middlewares/auth.middleware.ts` - ⚠️ NEEDS UPDATE (uses old config)
- `api/src/modules/users/user.service.ts` - ⚠️ NEEDS UPDATE (uses old config)
- `api/src/modules/users/user.routes.ts` - ⚠️ NEEDS UPDATE (uses old middleware)
- `api/src/modules/appointments/appointment.routes.ts` - ⚠️ NEEDS UPDATE (uses old middleware)

**Resolution Required:**

1. ✅ **DONE:** Deleted `api/src/config/rbac.ts`
2. ⚠️ **TODO:** Update `middlewares/auth.middleware.ts` to remove old RBAC imports
3. ⚠️ **TODO:** Update `modules/users/user.service.ts` to use new RBAC system
4. ⚠️ **TODO:** Update all routes to use new RBAC middleware from `modules/rbac/authorize.middleware.ts`
5. ⚠️ **TODO:** Update JWT payload to use new RBAC structure (with permissions array)

---

## ✅ GOOD CONFIGURATIONS

### 1. **Environment Configuration** (`env.ts`)

**Status:** ✅ **EXCELLENT**

**Strengths:**
- ✅ Uses Zod for validation
- ✅ Fails fast on invalid config
- ✅ Strong typing with exported types
- ✅ Sensible defaults
- ✅ Validates JWT secrets (min 32 chars)
- ✅ Validates DATABASE_URL format

**Recommendations:**
- Consider adding `CLINIC_ID` or tenant-related env vars if needed
- Consider adding `REDIS_URL` for permission version caching (future)

---

### 2. **Rate Limiting** (`rate-limit.ts`)

**Status:** ✅ **GOOD**

**Strengths:**
- ✅ Global rate limiter configured
- ✅ Stricter auth rate limiter (prevents brute force)
- ✅ Uses environment variables
- ✅ Returns proper error responses

**Recommendations:**
- ✅ Already follows best practices
- Consider per-tenant rate limiting (future enhancement)

---

### 3. **Swagger Configuration** (`swagger.ts`)

**Status:** ⚠️ **NEEDS UPDATE**

**Strengths:**
- ✅ Well-structured OpenAPI 3.0.3 spec
- ✅ Comprehensive schemas for User and Appointment
- ✅ Reusable components (parameters, schemas)
- ✅ Security schemes defined

**Issues:**
- ⚠️ Uses old `UserRole` enum (admin, user, guest) - should be (admin, doctor, patient)
- ⚠️ Missing `clinicId` in User schema
- ⚠️ Missing `tenantId` in Appointment schema
- ⚠️ No RBAC/permissions documentation
- ⚠️ No multi-tenant documentation

**Recommendations:**

```typescript
// Update UserRole enum
UserRole: {
  type: "string",
  enum: ["admin", "doctor", "patient"], // ← Updated
  example: "doctor",
},

// Add clinicId to User schema
User: {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    clinicId: { type: "string", format: "uuid" }, // ← Add this
    name: { type: "string" },
    email: { type: "string", format: "email" },
    role: { $ref: "#/components/schemas/UserRole" },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
},

// Add clinicId to Appointment schema
Appointment: {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    clinicId: { type: "string", format: "uuid" }, // ← Add this
    userId: { type: "string", format: "uuid" },
    // ... rest of fields
  },
},
```

---

## 📊 Configuration Comparison

### Old RBAC Config vs New RBAC System

| Aspect | Old (`config/rbac.ts`) | New (`modules/rbac/`) |
|--------|------------------------|------------------------|
| **Storage** | Hardcoded in code | Database (seeded) |
| **Roles** | 3 (admin, doctor, patient) | 5 (Super Admin, Clinic Admin, Doctor, Receptionist, Patient) |
| **Permissions** | 13 | 22 |
| **Format** | `view_users` | `users:view` |
| **Multi-role** | ❌ Single role per user | ✅ Multiple roles per user |
| **Tenant-specific** | ❌ No | ✅ Yes (global + clinic roles) |
| **JWT** | Role only | Roles + Permissions array |
| **Authorization** | Role-based | Permission-based |
| **Scalability** | ❌ Limited | ✅ Production-ready |

---

## 🔧 REQUIRED ACTIONS

### Priority 1: Fix RBAC Conflict (CRITICAL)

1. ✅ **DONE:** Delete `api/src/config/rbac.ts`

2. **Update `middlewares/auth.middleware.ts`:**
   - Remove imports from `config/rbac.ts`
   - Mark as deprecated
   - Add comment to use `modules/rbac/authorize.middleware.ts` instead

3. **Update `modules/users/user.service.ts`:**
   - Remove import from `config/rbac.ts`
   - Accept `permissions: string[]` instead of `role: RoleType`
   - Check permissions directly instead of using `hasPermission(role, permission)`

4. **Update all route files:**
   - Replace `import { authenticate, authorize } from "../../middlewares/auth.middleware.js"`
   - With `import { authenticate } from "../../middlewares/auth.middleware.js"`
   - And `import { authorize, authorizeAny } from "../rbac/authorize.middleware.js"`

5. **Update JWT structure:**
   - Ensure JWT includes `permissions: string[]` array
   - Ensure JWT includes `clinicId` (not `tenantId`)
   - Update `utils/jwt.ts` to match `modules/rbac/jwt-rbac.ts`

---

### Priority 2: Update Swagger Documentation

1. **Update schemas:**
   - Fix `UserRole` enum values
   - Add `clinicId` to User and Appointment schemas
   - Add RBAC documentation section

2. **Add RBAC components:**
   ```typescript
   Permission: {
     type: "string",
     enum: [
       "users:view", "users:create", "users:update", "users:delete",
       "appointments:view_all", "appointments:view_own",
       // ... all 22 permissions
     ],
   },
   ```

---

### Priority 3: Add Missing Configuration

1. **Consider adding `config/multi-tenant.ts`:**
   ```typescript
   export const multiTenantConfig = {
     // Tenant isolation rules
     enforceClinicId: true,
     allowCrossClinicAccess: false,
     
     // Email uniqueness
     emailUniquePerClinic: true,
   };
   ```

2. **Consider adding `config/rbac-cache.ts`:**
   ```typescript
   export const rbacCacheConfig = {
     // Permission version caching
     enableVersionCheck: true,
     cacheProvider: "redis", // or "memory"
     cacheTTL: 900, // 15 minutes
   };
   ```

---

## 📝 MIGRATION CHECKLIST

### Phase 1: Remove Old RBAC
- [x] Delete `config/rbac.ts`
- [ ] Update `middlewares/auth.middleware.ts` (mark as deprecated)
- [ ] Update `modules/users/user.service.ts` (remove old imports)
- [ ] Update all route files (use new middleware)

### Phase 2: Update JWT
- [ ] Update `utils/jwt.ts` to include permissions array
- [ ] Update auth service to generate new JWT format
- [ ] Test JWT generation and verification

### Phase 3: Update Documentation
- [ ] Update Swagger schemas
- [ ] Add RBAC documentation
- [ ] Update API documentation

### Phase 4: Testing
- [ ] Test authentication with new JWT
- [ ] Test authorization with new middleware
- [ ] Test multi-tenant isolation
- [ ] Test permission checks in services

---

## 🎯 RECOMMENDED STRUCTURE

```
api/src/config/
├── env.ts              ✅ GOOD - Environment validation
├── rate-limit.ts       ✅ GOOD - Rate limiting config
├── swagger.ts          ⚠️ NEEDS UPDATE - Add clinicId, fix roles
└── (rbac.ts)           ❌ DELETED - Conflicted with new system

api/src/modules/rbac/   ✅ USE THIS
├── rbac.schema.ts      ✅ Database schema
├── permissions.seed.ts ✅ 22 permissions + 5 roles
├── rbac.repository.ts  ✅ Data access
├── jwt-rbac.ts         ✅ JWT with permissions
├── authorize.middleware.ts ✅ Permission-based auth
└── auth-rbac.service.ts ✅ Auth with RBAC

api/src/middlewares/
└── auth.middleware.ts  ⚠️ DEPRECATED - Use modules/rbac/authorize.middleware.ts
```

---

## 📚 NEXT STEPS

1. **Immediate (Blocking):**
   - Fix RBAC conflict by updating all imports
   - Update JWT structure to include permissions
   - Update all routes to use new middleware

2. **Short-term:**
   - Update Swagger documentation
   - Add multi-tenant config documentation
   - Test end-to-end with new RBAC

3. **Long-term:**
   - Add Redis caching for permission versions
   - Add per-tenant rate limiting
   - Add RBAC admin UI

---

## ✅ SUMMARY

**Configuration Quality:** 7/10

**Strengths:**
- ✅ Excellent environment validation
- ✅ Good rate limiting setup
- ✅ Comprehensive Swagger documentation
- ✅ Production-ready RBAC system exists (in modules/rbac/)

**Critical Issues:**
- ❌ RBAC conflict between old and new systems
- ❌ Routes using old middleware
- ❌ Services using old permission checks
- ❌ JWT structure mismatch

**Action Required:**
- 🔴 **CRITICAL:** Migrate from old RBAC to new RBAC system
- 🟡 **IMPORTANT:** Update Swagger documentation
- 🟢 **NICE TO HAVE:** Add caching and multi-tenant config

---

**Status:** ⚠️ **REQUIRES IMMEDIATE ACTION**

The old RBAC config has been deleted. Now all files must be updated to use the new production-ready RBAC system from `modules/rbac/`.
