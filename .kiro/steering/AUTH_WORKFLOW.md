---
inclusion: always
---

# Auth Workflow — Healthcare SaaS

This document describes the complete authentication and authorization system.
Reference implementation: `api/src/modules/auth/` and `api/src/modules/rbac/`.

---

## Architecture Overview

```
POST /api/v1/auth/login
        │
        ▼
  staffUserRepository.findByEmail()     ← lookup in staff_users table
        │
        ▼
  bcrypt.compare()                      ← constant-time password check
        │
        ▼
  rbacRepository.getStaffUserWithRolesAndPermissions()
        │                               ← loads roles + permissions from DB
        ▼
  signAccessToken()                     ← short-lived JWT (default: 15m)
        │
        ▼
  authRepository.create()               ← opaque refresh token stored hashed in DB
        │
        ▼
  Response: { accessToken, refreshToken, user }
```

---

## Token Types

### Access Token (JWT)
- Short-lived: `JWT_EXPIRES_IN` (default `15m`)
- Signed with `JWT_SECRET`
- Never stored in DB — verified by signature only
- Payload shape:

```typescript
interface JwtPayloadRBAC {
  userId: string;          // staff_users.id
  clinicId?: string;       // present for clinic-scoped staff, absent for global admins
  email: string;
  userType: "staff";       // always "staff" — patients are not system users
  roles: string[];         // role names e.g. ["Doctor", "Clinic Admin"]
  permissions: string[];   // permission keys e.g. ["appointments:create"]
  permissionsVersion: number; // timestamp — for future stale-check use
}
```

### Refresh Token (opaque)
- Long-lived: `JWT_REFRESH_EXPIRES_IN` (default `7d`)
- Stored as SHA-256 hash in `refresh_tokens` table — raw value never persisted
- Supports token rotation + family-based reuse detection
- Soft-revoked via `revokedAt` timestamp

---

## Login Flow

### Staff Login (clinic-scoped)
```json
POST /api/v1/auth/login
{
  "email": "doctor@clinic.com",
  "password": "SecurePass1",
  "clinicId": "uuid-of-clinic"   ← optional: scopes token to this clinic
}
```

- With `clinicId` → JWT includes `clinicId`, loads global + clinic-specific roles
- Without `clinicId` → JWT has no `clinicId`, loads global roles only (Super Admin)

### Response
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "a3f9...",
    "user": { "id": "...", "name": "...", "email": "...", "roles": ["Doctor"] }
  }
}
```

---

## Token Rotation Flow

```
POST /api/v1/auth/refresh
{ "refreshToken": "raw-opaque-token" }
```

1. Hash the raw token → look up in `refresh_tokens` by `token_hash`
2. If not found → `401 Invalid refresh token`
3. If `revokedAt IS NOT NULL` → **reuse detected** → revoke entire family → `401`
4. If `expiresAt < now` → revoke token → `401 Expired`
5. Load staff user + roles from DB
6. If staff user inactive or deleted → revoke → `401`
7. Revoke old token (`revokedAt = now`)
8. Issue new access token + new refresh token (same `familyId`)
9. Return `{ accessToken, refreshToken }`

---

## Token Family & Reuse Detection

Each login creates a new `familyId` (UUID). All rotated tokens share the same `familyId`.

If a **revoked** token is presented:
- Someone is replaying a stolen token
- **All tokens in the family are immediately revoked**
- Forces re-login on all devices

```typescript
// authRepository
async revokeFamilyAll(familyId: string): Promise<void>
```

---

## Logout

```
POST /api/v1/auth/logout
{ "refreshToken": "raw-token" }
```
Soft-revokes the single token (`revokedAt = now`). Access token remains valid until expiry.

```
POST /api/v1/auth/logout-all    ← requires Bearer token
```
Revokes ALL refresh tokens for the staff user. Forces re-login on all devices.

---

## Middleware Chain

Every protected route uses this order:

```
authenticate → authorize(permission) → validate → controller
```

### `authenticate` (`middlewares/auth.middleware.ts`)
- Reads `Authorization: Bearer <token>`
- Verifies JWT signature
- Attaches `req.user: JwtPayloadRBAC`
- Sets `req.clinicId` for staff tokens (convenience shortcut)
- Returns `401` if missing or invalid

### `authorize(permission)` (`modules/rbac/authorize.middleware.ts`)
- Reads `req.user.permissions[]` — **no DB query**
- Returns `403` if permission not present
- Logs failed attempts with context

```typescript
// Single permission
router.post("/", authenticate, authorize("appointments:create"), controller.create);

// Any of these permissions
router.get("/", authenticate, authorizeAny(["appointments:view_all", "appointments:view_own"]), controller.list);

// All of these permissions
router.post("/admin", authenticate, authorizeAll(["clinic:update", "system:manage_settings"]), controller.admin);
```

---

## Service-Level Permission Check

Use inside services for conditional logic (not route-level):

```typescript
import { requirePermission, hasPermission } from "../rbac/authorize.middleware.js";

// Throws ForbiddenError if missing
requirePermission(req.user, "users:delete", req.t);

// Returns boolean for conditional logic
if (hasPermission(req.user, "appointments:view_all")) {
  // show all clinic appointments
} else {
  // show only own appointments
}
```

---

## RBAC Data Model

```
staff_users ──< staff_user_roles >── roles ──< role_permissions >── permissions
                    │
                    └── clinicId (nullable)
                         NULL  = global assignment (Super Admin)
                         UUID  = clinic-scoped assignment (Doctor at Clinic A)
```

### Role types
| `roles.clinicId` | Meaning | Example |
|---|---|---|
| `NULL` | Global role — applies platform-wide | Super Admin |
| `UUID` | Clinic role — scoped to one clinic | Doctor @ Clinic A |

### Permission keys (format: `resource:action`)
```
users:view          users:create        users:update        users:delete
appointments:view_all  appointments:view_own  appointments:create  appointments:update  appointments:delete
clinic:view         clinic:update       clinic:manage_billing
doctors:view        doctors:create      doctors:update      doctors:delete
patients:view       patients:create     patients:update     patients:delete
slots:generate      slots:book          slots:manage
roles:view          roles:create        roles:update        roles:delete
reports:view        reports:export
system:view_logs    system:manage_settings
```

---

## JWT Context in Controllers

```typescript
// Extract from req.user — always available after authenticate middleware
const context = {
  userId: req.user!.userId,          // staff_users.id
  clinicId: req.user!.clinicId,      // undefined for global admins
  userType: req.user!.userType,      // always "staff"
  permissions: req.user!.permissions,
};

// Staff routes always use clinicId from JWT — never from request body
const clinicId = req.user!.clinicId!;  // safe after authorize() for clinic routes
```

---

## Security Properties

| Property | Implementation |
|---|---|
| Timing-safe login | bcrypt always runs even when user not found (dummy hash) |
| Token storage | SHA-256 hash stored — raw token never in DB |
| Token rotation | Every refresh issues a new token, old one revoked |
| Stolen token detection | Family revocation on reuse |
| No DB hit per request | Permissions read from JWT payload |
| Rate limiting | `authRateLimiter` on login, refresh, logout endpoints |
| Soft-delete safe | `findByEmail` filters `deletedAt IS NULL` |

---

## Token Cleanup (Cron Job)

Expired tokens accumulate in `refresh_tokens`. Run periodically:

```typescript
import { authRepository } from "./modules/auth/auth.repository.js";

// Delete all rows where expiresAt < now
await authRepository.deleteExpired();
```

Recommended: daily cron job or scheduled task.

---

## Files Reference

| File | Purpose |
|---|---|
| `modules/auth/auth.schema.ts` | `refresh_tokens` table |
| `modules/auth/auth.repository.ts` | Token CRUD + revocation |
| `modules/auth/auth.service.ts` | Login, refresh, logout business logic |
| `modules/auth/auth.validation.ts` | Zod schemas for login/refresh inputs |
| `modules/auth/auth.controller.ts` | HTTP handlers |
| `modules/auth/auth.routes.ts` | Route definitions with rate limiting |
| `modules/rbac/jwt-rbac.ts` | JWT sign/verify + payload type |
| `modules/rbac/rbac.repository.ts` | Load staff user roles + permissions |
| `modules/rbac/rbac.schema.ts` | roles, permissions, role_permissions, staff_user_roles |
| `middlewares/auth.middleware.ts` | `authenticate` middleware |
| `modules/rbac/authorize.middleware.ts` | `authorize`, `authorizeAny`, `authorizeAll` |
