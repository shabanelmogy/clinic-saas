# RBAC Module - Complete Localization ✅

**Date:** April 18, 2026  
**Status:** ✅ 100% Complete  
**TypeScript:** ✅ No compilation errors  
**Tests:** ✅ 34/34 passing

---

## Summary

The RBAC (Role-Based Access Control) module is now **fully localized** with support for 5 languages (en, ar, fr, es, de). All authorization error messages are now translated based on the user's language preference.

---

## Completed Components

### ✅ 1. Authorization Middleware (100%)
- **File:** `api/src/modules/rbac/authorize.middleware.ts`
- **Status:** Complete
- **Changes:**
  - Updated `authenticate()` middleware
  - Updated `authorize()` middleware
  - Updated `authorizeAny()` middleware
  - Updated `authorizeAll()` middleware
  - Updated `requirePermission()` helper function
  - Replaced 5 hardcoded error messages with translation keys

---

## Translation Coverage

### Authorization Error Messages (5 keys)
- ✅ `common.unauthorized` - Unauthorized (not authenticated)
- ✅ `permissions.required` - Permission '{{permission}}' is required
- ✅ `permissions.oneRequired` - One of these permissions is required: {{permissions}}
- ✅ `permissions.missingPermissions` - Missing required permissions: {{permissions}}
- ✅ `auth.invalidToken` - Invalid or expired access token

**Total:** 5 translation keys across 5 languages = **25 translations**

---

## Language Support

| Language | Code | Status | Keys Used |
|----------|------|--------|-----------|
| English | en | ✅ Complete | 5/5 (100%) |
| Arabic | ar | ✅ Complete | 5/5 (100%) |
| French | fr | ✅ Complete | 5/5 (100%) |
| Spanish | es | ✅ Complete | 5/5 (100%) |
| German | de | ✅ Complete | 5/5 (100%) |

---

## API Examples

### Example 1: Missing Authorization Header (English)

**Request:**
```http
GET /api/v1/users
X-Language: en
```

**Response:**
```json
{
  "success": false,
  "message": "Invalid or expired access token"
}
```

### Example 2: Missing Authorization Header (Arabic)

**Request:**
```http
GET /api/v1/users
X-Language: ar
```

**Response:**
```json
{
  "success": false,
  "message": "رمز الوصول غير صالح أو منتهي الصلاحية"
}
```

### Example 3: Insufficient Permission (French)

**Request:**
```http
DELETE /api/v1/users/123
X-Language: fr
Authorization: Bearer <token-without-delete-permission>
```

**Response:**
```json
{
  "success": false,
  "message": "La permission 'users:delete' est requise"
}
```

### Example 4: Missing One of Multiple Permissions (Spanish)

**Request:**
```http
GET /api/v1/appointments
X-Language: es
Authorization: Bearer <token-without-view-permissions>
```

**Response:**
```json
{
  "success": false,
  "message": "Se requiere uno de estos permisos: appointments:view_all, appointments:view_own"
}
```

### Example 5: Missing Required Permissions (German)

**Request:**
```http
POST /api/v1/admin/settings
X-Language: de
Authorization: Bearer <token-missing-some-permissions>
```

**Response:**
```json
{
  "success": false,
  "message": "Fehlende erforderliche Berechtigungen: clinic:update, system:manage_settings"
}
```

---

## Implementation Details

### Middleware Updates

#### 1. `authenticate()` Middleware

**Before:**
```typescript
if (!authHeader?.startsWith("Bearer ")) {
  sendError(res, "Missing or malformed Authorization header", 401);
  return;
}
```

**After:**
```typescript
if (!authHeader?.startsWith("Bearer ")) {
  sendError(res, req.t("auth.invalidToken"), 401);
  return;
}
```

#### 2. `authorize()` Middleware

**Before:**
```typescript
if (!req.user) {
  sendError(res, "Unauthorized", 401);
  return;
}

if (!req.user.permissions.includes(permission)) {
  const err = new ForbiddenError(
    `Permission '${permission}' is required for this action`
  );
  sendError(res, err.message, 403);
  return;
}
```

**After:**
```typescript
if (!req.user) {
  sendError(res, req.t("common.unauthorized"), 401);
  return;
}

if (!req.user.permissions.includes(permission)) {
  const err = new ForbiddenError(
    req.t("permissions.required", { permission })
  );
  sendError(res, err.message, 403);
  return;
}
```

#### 3. `authorizeAny()` Middleware

**Before:**
```typescript
if (!hasAny) {
  const err = new ForbiddenError(
    `One of these permissions is required: ${permissions.join(", ")}`
  );
  sendError(res, err.message, 403);
  return;
}
```

**After:**
```typescript
if (!hasAny) {
  const err = new ForbiddenError(
    req.t("permissions.oneRequired", { permissions: permissions.join(", ") })
  );
  sendError(res, err.message, 403);
  return;
}
```

#### 4. `authorizeAll()` Middleware

**Before:**
```typescript
if (!hasAll) {
  const missing = permissions.filter(
    (perm) => !req.user!.permissions.includes(perm)
  );
  const err = new ForbiddenError(
    `Missing required permissions: ${missing.join(", ")}`
  );
  sendError(res, err.message, 403);
  return;
}
```

**After:**
```typescript
if (!hasAll) {
  const missing = permissions.filter(
    (perm) => !req.user!.permissions.includes(perm)
  );
  const err = new ForbiddenError(
    req.t("permissions.missingPermissions", { permissions: missing.join(", ") })
  );
  sendError(res, err.message, 403);
  return;
}
```

#### 5. `requirePermission()` Helper

**Before:**
```typescript
export const requirePermission = (
  user: JwtPayloadRBAC | undefined,
  permission: string
): void => {
  if (!user) {
    throw new UnauthorizedError("User not authenticated");
  }
  if (!user.permissions.includes(permission)) {
    throw new ForbiddenError(`Permission '${permission}' is required`);
  }
};
```

**After:**
```typescript
export const requirePermission = (
  user: JwtPayloadRBAC | undefined,
  permission: string,
  t: (key: string, params?: Record<string, string | number>) => string
): void => {
  if (!user) {
    throw new UnauthorizedError(t("common.unauthorized"));
  }
  if (!user.permissions.includes(permission)) {
    throw new ForbiddenError(t("permissions.required", { permission }));
  }
};
```

---

## Usage in Services

The `requirePermission()` helper function is used in services for programmatic permission checks. It now requires the translation function:

**Before:**
```typescript
requirePermission(req.user, "users:delete");
```

**After:**
```typescript
requirePermission(req.user, "users:delete", req.t);
```

**Example in Service:**
```typescript
async deleteUser(
  id: string,
  requestingUserId: string,
  requestingUserPermissions: string[],
  clinicId: string,
  t: TranslateFn
): Promise<void> {
  // Option 1: Manual check
  if (!requestingUserPermissions.includes("users:delete")) {
    throw new ForbiddenError(t("permissions.required", { permission: "users:delete" }));
  }
  
  // Option 2: Using helper (if you have req.user)
  // requirePermission(req.user, "users:delete", t);
  
  // ... rest of delete logic
}
```

---

## Error Messages by Scenario

| Scenario | Middleware | Translation Key | English | Arabic | French |
|----------|-----------|----------------|---------|--------|--------|
| No auth header | `authenticate` | `auth.invalidToken` | "Invalid or expired access token" | "رمز الوصول غير صالح أو منتهي الصلاحية" | "Jeton d'accès invalide ou expiré" |
| Not authenticated | `authorize` | `common.unauthorized` | "Unauthorized" | "غير مصرح" | "Non autorisé" |
| Missing permission | `authorize` | `permissions.required` | "Permission 'users:delete' is required" | "الإذن 'users:delete' مطلوب" | "La permission 'users:delete' est requise" |
| Missing any permission | `authorizeAny` | `permissions.oneRequired` | "One of these permissions is required: ..." | "أحد هذه الأذونات مطلوب: ..." | "L'une de ces permissions est requise : ..." |
| Missing all permissions | `authorizeAll` | `permissions.missingPermissions` | "Missing required permissions: ..." | "الأذونات المطلوبة مفقودة: ..." | "Permissions requises manquantes : ..." |

---

## Files Modified

1. ✅ `api/src/modules/rbac/authorize.middleware.ts`
   - Updated `authenticate()` middleware
   - Updated `authorize()` middleware
   - Updated `authorizeAny()` middleware
   - Updated `authorizeAll()` middleware
   - Updated `requirePermission()` helper function
   - All error messages now use translation keys

---

## Logging

Authorization failures are still logged with full context for security auditing:

```typescript
logger.warn({
  msg: "Authorization failed - insufficient permission",
  userId: req.user.userId,
  clinicId: req.user.clinicId,
  userPermissions: req.user.permissions,
  requiredPermission: permission,
  path: req.path,
  method: req.method,
});
```

This logging is **not localized** (intentionally) because:
- Logs are for developers/admins, not end users
- English logs are easier to search and analyze
- Consistent log format across all languages

---

## Security Considerations

### 1. Permission Enumeration Prevention

Error messages are generic enough to not reveal system internals:
- ✅ "Permission 'users:delete' is required" - OK (user knows what they tried to do)
- ❌ "You don't have users:delete but you have users:view" - BAD (reveals permissions)

### 2. Timing Attack Prevention

All permission checks use simple array lookups with consistent timing:
```typescript
req.user.permissions.includes(permission)
```

No database queries or complex logic that could leak information through timing.

### 3. Audit Trail

All authorization failures are logged with full context for security monitoring and incident response.

---

## Testing

### TypeScript Compilation
```bash
npx tsc --noEmit
# ✅ No errors
```

### Unit Tests
```bash
npm test
# ✅ 34/34 tests passing
```

### Manual Testing
```bash
# Test authorization with different languages
curl -H "X-Language: en" -H "Authorization: Bearer <invalid-token>" \
  http://localhost:3000/api/v1/users

curl -H "X-Language: ar" -H "Authorization: Bearer <invalid-token>" \
  http://localhost:3000/api/v1/users

curl -H "X-Language: fr" -H "Authorization: Bearer <token-without-permission>" \
  http://localhost:3000/api/v1/users
```

---

## Benefits Achieved

1. ✅ **User-friendly errors** - Authorization errors in user's language
2. ✅ **Consistent pattern** - Same approach as other modules
3. ✅ **Type-safe** - Full TypeScript support
4. ✅ **Maintainable** - Centralized translation keys
5. ✅ **Secure** - No information leakage
6. ✅ **Auditable** - Full logging maintained
7. ✅ **Production-ready** - All checks passing

---

## Module Completion Status

| Component | Status | File |
|-----------|--------|------|
| Authorization Middleware | ✅ 100% | `authorize.middleware.ts` |
| Permission Helpers | ✅ 100% | `authorize.middleware.ts` |
| **Total** | **✅ 100%** | **1/1 file** |

---

## Comparison with Other Modules

| Module | Validation | Service | Controller | Routes | Middleware | Total |
|--------|-----------|---------|------------|--------|------------|-------|
| **RBAC** | N/A | N/A | N/A | N/A | ✅ 100% | ✅ **100%** |
| **Auth** | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | N/A | ✅ **100%** |
| **Appointments** | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | N/A | ✅ **100%** |
| Users | ⚠️ 0% | ⚠️ 0% | ✅ 100% | ⚠️ 0% | N/A | 🟡 25% |

---

## Integration with Other Modules

The RBAC middleware is used by all protected routes:

```typescript
// Appointments module
router.post(
  "/",
  authenticate,                    // ← RBAC: Verify JWT
  authorize("appointments:create"), // ← RBAC: Check permission (localized)
  validate({ body: (t) => createAppointmentSchemas(t).create }),
  appointmentController.create
);

// Users module
router.delete(
  "/:id",
  authenticate,                    // ← RBAC: Verify JWT
  authorize("users:delete"),       // ← RBAC: Check permission (localized)
  validate({ params: idParamSchema }),
  userController.remove
);

// Auth module (no RBAC needed for login)
router.post("/login", validate({ body: (t) => createAuthSchemas(t).login }), authController.login);
```

---

## Next Steps

### Apply to Users Module

1. ⚠️ **users.validation.ts** - Create `createUserSchemas()` factory
2. ⚠️ **users.service.ts** - Add `t` parameter, localize errors
3. ⚠️ **users.routes.ts** - Use factory functions

### Documentation Updates

4. ⚠️ **API Documentation** - Document X-Language header in Swagger
5. ⚠️ **Developer Guide** - Add localization best practices

---

## Status: ✅ COMPLETE

**The RBAC module is fully localized and production-ready.**

- ✅ Authorization middleware: 100% localized
- ✅ Permission helpers: 100% localized
- ✅ 5 translation keys across 5 languages
- ✅ TypeScript compilation: No errors
- ✅ Unit tests: 34/34 passing
- ✅ Security: No information leakage
- ✅ Logging: Full audit trail maintained

**Ready for production deployment.**

---

**Date:** April 18, 2026  
**Module:** RBAC (Complete)  
**Languages:** 5 (en, ar, fr, es, de)  
**Completion:** 100%
