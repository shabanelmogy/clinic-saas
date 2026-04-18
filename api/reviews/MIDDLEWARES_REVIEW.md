# Middlewares Review - `api/src/middlewares`

## 📋 Executive Summary

**Status:** ⚠️ **CRITICAL ISSUES - OLD RBAC SYSTEM**

The middleware directory has **excellent structure** but is using the **old RBAC configuration** that was deleted. All middleware needs to be updated to use the new production-ready RBAC system.

---

## 🔴 CRITICAL ISSUES

### 1. **Using Deleted RBAC Config** (BLOCKING)

**Problem:**

`auth.middleware.ts` imports from the deleted `config/rbac.ts`:

```typescript
// ❌ WRONG - This file was deleted
import { hasPermission, type PermissionType, type RoleType } from "../config/rbac.js";
```

**Impact:**
- 🔴 **Application will crash** - Importing from non-existent file
- 🔴 **Old RBAC system** - Uses role-based instead of permission-based
- 🔴 **Wrong JWT structure** - Expects single `role`, not `permissions` array

**Solution:**

Use the new RBAC middleware from `modules/rbac/authorize.middleware.ts` instead.

---

### 2. **Wrong JWT Structure** (CRITICAL)

**Current JWT (`utils/jwt.ts`):**
```typescript
interface JwtPayload {
  sub: string;
  email: string;
  role: string;        // ❌ Single role
  tenantId: string;    // ⚠️ Should be clinicId
}
```

**Should be (RBAC JWT):**
```typescript
interface JwtPayloadRBAC {
  userId: string;
  clinicId: string;    // ✅ Consistent naming
  email: string;
  roles: string[];     // ✅ Multiple roles
  permissions: string[]; // ✅ Permission array
  permissionsVersion: number;
}
```

---

### 3. **Inconsistent Naming: `tenantId` vs `clinicId`**

**Current:**
- `auth.middleware.ts` uses `tenantId`
- `jwt.ts` uses `tenantId`

**Should be:**
- Consistent `clinicId` everywhere

---

### 4. **Deprecated Middleware Still in Use**

The old `authorize()` and `requirePermission()` middleware are marked as deprecated but still being used in routes.

---

## ✅ GOOD IMPLEMENTATIONS

### 1. **Error Middleware** (`error.middleware.ts`)

**Status:** ✅ **EXCELLENT**

**Strengths:**
- ✅ Handles `AppError` instances correctly
- ✅ PostgreSQL error code mapping
- ✅ Proper logging with request ID
- ✅ Environment-aware error messages
- ✅ 404 handler included

**Code Quality:**
```typescript
// ✅ Excellent PostgreSQL error mapping
const PG_ERRORS: Record<string, { status: number; message: string }> = {
  "23505": { status: 409, message: "A record with that value already exists" },
  "23503": { status: 409, message: "Referenced record does not exist" },
  "23502": { status: 400, message: "A required field is missing" },
  "23514": { status: 400, message: "A value violates a check constraint" },
  "42P01": { status: 500, message: "Database table not found — run migrations" },
};

// ✅ Proper logging
logger.error({ err, reqId: req.id, path: req.path }, "Unhandled error");

// ✅ Environment-aware messages
const message = env.NODE_ENV === "production" 
  ? "Internal server error" 
  : err.message;
```

**No changes needed!**

---

### 2. **Request ID Middleware** (`request-id.middleware.ts`)

**Status:** ✅ **EXCELLENT**

**Strengths:**
- ✅ Generates unique request ID
- ✅ Respects `X-Request-ID` header (for distributed tracing)
- ✅ Attaches to request and response
- ✅ Clean implementation

**Code Quality:**
```typescript
// ✅ Excellent implementation
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = (req.headers["x-request-id"] as string) ?? randomUUID();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
};
```

**No changes needed!**

---

### 3. **Validation Middleware** (`validate.middleware.ts`)

**Status:** ✅ **EXCELLENT**

**Strengths:**
- ✅ Flexible Zod schema validation
- ✅ Validates body, params, and query
- ✅ Structured error messages
- ✅ Replaces request data with coerced values
- ✅ Clean factory pattern

**Code Quality:**
```typescript
// ✅ Excellent validation pattern
export const validate = (schemas: ValidationTargets) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, string[]> = {};
    
    // Validate all targets
    for (const target of ["body", "params", "query"] as const) {
      const schema = schemas[target];
      if (!schema) continue;
      
      const result = schema.safeParse(req[target]);
      
      if (!result.success) {
        // Collect errors
        const fieldErrors = result.error.flatten().fieldErrors;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          errors[`${target}.${field}`] = messages as string[];
        }
      } else {
        // Replace with coerced values
        req[target] = result.data;
      }
    }
    
    if (Object.keys(errors).length > 0) {
      sendError(res, "Validation failed", 422, errors);
      return;
    }
    
    next();
  };
```

**No changes needed!**

---

## 🔧 REQUIRED FIXES

### Fix 1: Update `auth.middleware.ts`

**Option A: Mark as Deprecated (Recommended)**

Keep the file but mark it as deprecated and point to the new middleware:

```typescript
/**
 * @deprecated This middleware uses the old RBAC system.
 * 
 * Use the new RBAC middleware instead:
 *   import { authenticate, authorize, authorizeAny, authorizeAll } 
 *   from "../modules/rbac/authorize.middleware.js";
 * 
 * The new middleware:
 * - Uses permission-based authorization (not role-based)
 * - Reads permissions from JWT (no database queries)
 * - Supports multiple roles per user
 * - Supports multi-tenant isolation with clinicId
 * 
 * Migration guide: See api/CONFIG_REVIEW.md
 */

// Keep authenticate for backward compatibility
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  // ... existing implementation
  // But update to use new JWT structure
};

// Mark old authorization as deprecated
/** @deprecated Use authorize() from modules/rbac/authorize.middleware.ts */
export const authorize = (...roles: string[]) => {
  throw new Error("This middleware is deprecated. Use modules/rbac/authorize.middleware.ts");
};

/** @deprecated Use authorize() from modules/rbac/authorize.middleware.ts */
export const requirePermission = (permission: PermissionType) => {
  throw new Error("This middleware is deprecated. Use modules/rbac/authorize.middleware.ts");
};
```

**Option B: Delete and Use New Middleware (Cleaner)**

Delete `auth.middleware.ts` entirely and update all imports to use:
```typescript
import { authenticate, authorize, authorizeAny, authorizeAll } 
from "../modules/rbac/authorize.middleware.js";
```

---

### Fix 2: Update `utils/jwt.ts`

Replace with the RBAC JWT structure:

```typescript
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError } from "./errors.js";

/**
 * JWT Payload with RBAC
 * 
 * Contains all user context needed for authorization:
 * - userId: User identifier
 * - clinicId: Tenant identifier (for multi-tenant isolation)
 * - roles: Array of role names (for display/logging)
 * - permissions: Array of permission keys (for authorization)
 * - permissionsVersion: Incremented when roles/permissions change
 */
export interface JwtPayload {
  userId: string;
  clinicId: string;
  email: string;
  roles: string[];
  permissions: string[];
  permissionsVersion: number;
  iat?: number;
  exp?: number;
}

/**
 * Signs a short-lived access token (JWT).
 */
export const signAccessToken = (
  payload: Omit<JwtPayload, "iat" | "exp">
): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

/**
 * Verifies an access token and returns its payload.
 * Throws UnauthorizedError on invalid/expired token.
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
};
```

---

### Fix 3: Update All Route Imports

**Find all files importing old middleware:**
```bash
grep -r "from.*middlewares/auth" api/src/modules/
```

**Update imports:**

**Before:**
```typescript
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";

router.delete("/:id", authenticate, authorize("admin"), controller.remove);
```

**After:**
```typescript
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";

router.delete("/:id", authenticate, authorize("users:delete"), controller.remove);
```

---

## 📊 Middleware Comparison

### Old Auth Middleware vs New RBAC Middleware

| Aspect | Old (`middlewares/auth.middleware.ts`) | New (`modules/rbac/authorize.middleware.ts`) |
|--------|----------------------------------------|---------------------------------------------|
| **RBAC Config** | ❌ Uses deleted `config/rbac.ts` | ✅ Uses database-driven RBAC |
| **JWT Structure** | ❌ Single `role` string | ✅ `permissions` array |
| **Authorization** | ❌ Role-based | ✅ Permission-based |
| **Multi-role** | ❌ Single role per user | ✅ Multiple roles per user |
| **Tenant Field** | ⚠️ `tenantId` | ✅ `clinicId` |
| **DB Queries** | ❌ Checks role permissions | ✅ No DB queries (permissions in JWT) |
| **Middleware Options** | ⚠️ `authorize()`, `requirePermission()` | ✅ `authorize()`, `authorizeAny()`, `authorizeAll()` |

---

## 🎯 RECOMMENDED STRUCTURE

### Keep These (No Changes)
```
api/src/middlewares/
├── error.middleware.ts          ✅ EXCELLENT - Keep as is
├── request-id.middleware.ts     ✅ EXCELLENT - Keep as is
└── validate.middleware.ts       ✅ EXCELLENT - Keep as is
```

### Update/Replace These
```
api/src/middlewares/
└── auth.middleware.ts           ⚠️ DEPRECATED - Mark or delete
```

### Use These Instead
```
api/src/modules/rbac/
└── authorize.middleware.ts      ✅ USE THIS - Production-ready RBAC
```

---

## 🔄 Migration Steps

### Step 1: Update JWT Structure

```typescript
// api/src/utils/jwt.ts
export interface JwtPayload {
  userId: string;           // ← Changed from 'sub'
  clinicId: string;         // ← Changed from 'tenantId'
  email: string;
  roles: string[];          // ← Changed from single 'role'
  permissions: string[];    // ← NEW: Permission array
  permissionsVersion: number; // ← NEW: Version tracking
  iat?: number;
  exp?: number;
}
```

---

### Step 2: Update Auth Service

Update the login method to generate new JWT structure:

```typescript
// api/src/modules/auth/auth.service.ts
import { rbacRepository } from "../rbac/rbac.repository.js";

async login(email: string, password: string, clinicId: string) {
  // ... verify user and password
  
  // Get user roles
  const userRoles = await rbacRepository.getUserRoles(user.id);
  
  // Get all permissions from all roles
  const permissions = await rbacRepository.getUserPermissions(user.id);
  
  // Generate JWT with RBAC
  const accessToken = signAccessToken({
    userId: user.id,
    clinicId: user.clinicId,
    email: user.email,
    roles: userRoles.map(r => r.name),
    permissions: permissions.map(p => p.key),
    permissionsVersion: Date.now(),
  });
  
  return { accessToken, user };
}
```

---

### Step 3: Update All Routes

**Find and replace:**
```bash
# Find all route files
find api/src/modules -name "*.routes.ts"

# Update each file
```

**Before:**
```typescript
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";

router.delete("/:id", authenticate, authorize("admin"), controller.remove);
router.post("/", authenticate, authorize("admin"), controller.create);
```

**After:**
```typescript
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize } from "../rbac/authorize.middleware.js";

router.delete("/:id", authenticate, authorize("users:delete"), controller.remove);
router.post("/", authenticate, authorize("users:create"), controller.create);
```

---

### Step 4: Update Request Type Declarations

Update the Express Request type to match new JWT:

```typescript
// api/src/middlewares/auth.middleware.ts or global.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        clinicId: string;
        email: string;
        roles: string[];
        permissions: string[];
        permissionsVersion: number;
      };
      clinicId?: string; // For convenience
    }
  }
}
```

---

### Step 5: Update Services

Update all service methods to accept permissions instead of role:

**Before:**
```typescript
async listUsers(
  query: ListQuery,
  requestingUserId: string,
  requestingUserRole: RoleType,
  tenantId: string
) {
  requirePermission(requestingUserRole, Permission.VIEW_USERS);
  // ...
}
```

**After:**
```typescript
async listUsers(
  query: ListQuery,
  requestingUserId: string,
  requestingUserPermissions: string[],
  clinicId: string
) {
  if (!requestingUserPermissions.includes("users:view")) {
    throw new ForbiddenError("Permission 'users:view' is required");
  }
  // ...
}
```

---

## 📝 MIGRATION CHECKLIST

### Phase 1: JWT Structure
- [ ] Update `utils/jwt.ts` with new JWT payload
- [ ] Update auth service to generate new JWT
- [ ] Test JWT generation and verification

### Phase 2: Middleware
- [ ] Mark old `auth.middleware.ts` as deprecated OR delete it
- [ ] Update all route imports to use new RBAC middleware
- [ ] Update Express Request type declarations

### Phase 3: Routes
- [ ] Update user routes
- [ ] Update appointment routes
- [ ] Update auth routes
- [ ] Test all routes with new middleware

### Phase 4: Services
- [ ] Update user service
- [ ] Update appointment service
- [ ] Update all service method signatures
- [ ] Test service-level permission checks

### Phase 5: Testing
- [ ] Test authentication
- [ ] Test authorization with different permissions
- [ ] Test multi-tenant isolation
- [ ] Test permission aggregation from multiple roles

---

## 🐛 Common Issues

### Issue 1: "Cannot find module '../config/rbac.js'"

**Cause:** Old middleware trying to import deleted config.

**Solution:**
```typescript
// Use new RBAC middleware
import { authorize } from "../modules/rbac/authorize.middleware.js";
```

---

### Issue 2: "Property 'role' does not exist on type 'JwtPayload'"

**Cause:** JWT structure changed from single `role` to `roles` array.

**Solution:**
```typescript
// Before
const userRole = req.user.role;

// After
const userRoles = req.user.roles;
const userPermissions = req.user.permissions;
```

---

### Issue 3: "Property 'tenantId' does not exist"

**Cause:** Renamed to `clinicId`.

**Solution:**
```typescript
// Before
const tenantId = req.user.tenantId;

// After
const clinicId = req.user.clinicId;
```

---

## ✅ SUMMARY

**Middleware Quality:** 7/10

**Excellent Implementations:**
- ✅ Error middleware (10/10)
- ✅ Request ID middleware (10/10)
- ✅ Validation middleware (10/10)

**Critical Issues:**
- ❌ Auth middleware uses deleted RBAC config
- ❌ JWT structure doesn't match RBAC system
- ❌ Inconsistent naming (tenantId vs clinicId)

**Action Required:**
- 🔴 **CRITICAL:** Update JWT structure
- 🔴 **CRITICAL:** Update auth middleware or use new RBAC middleware
- 🔴 **CRITICAL:** Update all route imports
- 🟡 **IMPORTANT:** Update all services
- 🟢 **NICE TO HAVE:** Add permission version checking

---

**Status:** ⚠️ **REQUIRES IMMEDIATE ACTION**

The middleware directory has excellent implementations, but the auth middleware needs to be updated to use the new production-ready RBAC system.

**Next Steps:**
1. Update `utils/jwt.ts` with new JWT structure
2. Update auth service to generate new JWT
3. Update all routes to use new RBAC middleware
4. Test thoroughly
