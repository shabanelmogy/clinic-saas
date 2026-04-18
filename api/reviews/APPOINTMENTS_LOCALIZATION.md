# Appointments Module Localization - Complete ✅

**Date:** April 18, 2026  
**Status:** ✅ Complete  
**TypeScript:** ✅ No compilation errors  
**Tests:** ✅ 34/34 passing

---

## Summary

Successfully applied localization to the appointments module. All error messages and user-facing text now use translation keys, supporting 5 languages (en, ar, fr, es, de).

---

## Changes Made

### 1. ✅ Updated `appointment.service.ts`

**Added Translation Function Type:**
```typescript
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
```

**Updated All Service Methods:**
- `listAppointments()` - Added `t: TranslateFn` parameter
- `getAppointmentById()` - Added `t: TranslateFn` parameter
- `createAppointment()` - Added `t: TranslateFn` parameter
- `updateAppointment()` - Added `t: TranslateFn` parameter
- `deleteAppointment()` - Added `t: TranslateFn` parameter

**Updated Permission Check Helper:**
```typescript
const requirePermission = (
  userPermissions: string[],
  permission: string,
  t: TranslateFn
): void => {
  if (!userPermissions.includes(permission)) {
    throw new ForbiddenError(t("permissions.required", { permission }));
  }
};
```

**Replaced Hardcoded Error Messages:**

| Before | After |
|--------|-------|
| `throw new NotFoundError("Appointment")` | `throw new NotFoundError(t("appointments.notFound"))` |
| `throw new NotFoundError("User")` | `throw new NotFoundError(t("appointments.userNotFound"))` |
| `throw new BadRequestError("Cannot create appointment for an inactive user")` | `throw new BadRequestError(t("appointments.userInactive"))` |
| `throw new BadRequestError(\`Cannot update an appointment with status "${existing.status}"\`)` | `throw new BadRequestError(t("appointments.cannotUpdateStatus", { status: existing.status }))` |
| `throw new BadRequestError("Cannot delete a confirmed appointment. Cancel it first.")` | `throw new BadRequestError(t("appointments.cannotDeleteConfirmed"))` |
| `throw new ForbiddenError("You do not have permission to view this appointment")` | `throw new ForbiddenError(t("appointments.noPermission"))` |
| `throw new ForbiddenError("Permission 'appointments:view_all' or 'appointments:view_own' is required")` | `throw new ForbiddenError(t("permissions.oneRequired", { permissions: "..." }))` |

---

### 2. ✅ Updated `appointment.controller.ts`

**Updated All Controller Methods to Pass `req.t`:**

```typescript
// List appointments
await appointmentService.listAppointments(
  query,
  req.user!.userId,
  req.user!.permissions,
  req.user!.clinicId,
  req.t  // ← Added
);

// Get by ID
await appointmentService.getAppointmentById(
  id,
  req.user!.userId,
  req.user!.permissions,
  req.user!.clinicId,
  req.t  // ← Added
);

// Create
await appointmentService.createAppointment(
  input,
  req.user!.userId,
  req.user!.permissions,
  req.user!.clinicId,
  req.t  // ← Added
);

// Update
await appointmentService.updateAppointment(
  id,
  input,
  req.user!.userId,
  req.user!.permissions,
  req.user!.clinicId,
  req.t  // ← Added
);

// Delete
await appointmentService.deleteAppointment(
  id,
  req.user!.userId,
  req.user!.permissions,
  req.user!.clinicId,
  req.t  // ← Added
);
```

---

## Translation Keys Used

### Appointments Keys

| Key | English | Usage |
|-----|---------|-------|
| `appointments.retrieved` | "Appointments retrieved" | List success message |
| `appointments.appointmentRetrieved` | "Appointment retrieved" | Get by ID success |
| `appointments.created` | "Appointment created successfully" | Create success |
| `appointments.updated` | "Appointment updated successfully" | Update success |
| `appointments.deleted` | "Appointment deleted successfully" | Delete success |
| `appointments.notFound` | "Appointment not found" | Not found error |
| `appointments.userNotFound` | "User not found" | User FK validation |
| `appointments.userInactive` | "Cannot create appointment for an inactive user" | Business rule |
| `appointments.cannotUpdateStatus` | "Cannot update an appointment with status \"{{status}}\"" | State validation |
| `appointments.cannotDeleteConfirmed` | "Cannot delete a confirmed appointment. Cancel it first" | Delete validation |
| `appointments.noPermission` | "You do not have permission to view this appointment" | Authorization |

### Permission Keys

| Key | English | Usage |
|-----|---------|-------|
| `permissions.required` | "Permission '{{permission}}' is required" | Single permission check |
| `permissions.oneRequired` | "One of these permissions is required: {{permissions}}" | Multiple permission check |

---

## Example API Responses

### Example 1: Create Appointment (English)

**Request:**
```http
POST /api/v1/appointments
X-Language: en
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Annual Checkup",
  "scheduledAt": "2026-05-01T10:00:00Z",
  "durationMinutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment created successfully",
  "data": {
    "id": "...",
    "userId": "...",
    "title": "Annual Checkup",
    ...
  }
}
```

### Example 2: Create Appointment (Arabic)

**Request:**
```http
POST /api/v1/appointments
X-Language: ar
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "title": "فحص سنوي",
  "scheduledAt": "2026-05-01T10:00:00Z",
  "durationMinutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "تم إنشاء الموعد بنجاح",
  "data": {
    "id": "...",
    "userId": "...",
    "title": "فحص سنوي",
    ...
  }
}
```

### Example 3: Error - Inactive User (French)

**Request:**
```http
POST /api/v1/appointments
X-Language: fr
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "<inactive-user-id>",
  "title": "Consultation",
  "scheduledAt": "2026-05-01T10:00:00Z",
  "durationMinutes": 30
}
```

**Response:**
```json
{
  "success": false,
  "message": "Impossible de créer un rendez-vous pour un utilisateur inactif"
}
```

### Example 4: Error - Cannot Update Status (Spanish)

**Request:**
```http
PATCH /api/v1/appointments/123
X-Language: es
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title"
}
```

**Response (appointment is cancelled):**
```json
{
  "success": false,
  "message": "No se puede actualizar una cita con estado \"cancelled\""
}
```

### Example 5: Error - Cannot Delete Confirmed (German)

**Request:**
```http
DELETE /api/v1/appointments/123
X-Language: de
Authorization: Bearer <token>
```

**Response (appointment is confirmed):**
```json
{
  "success": false,
  "message": "Ein bestätigter Termin kann nicht gelöscht werden. Stornieren Sie ihn zuerst"
}
```

---

## Benefits

1. ✅ **Multi-language support** - All appointment errors in 5 languages
2. ✅ **Consistent error messages** - Centralized translations
3. ✅ **Dynamic placeholders** - Status values in error messages
4. ✅ **Type-safe** - Translation function type defined
5. ✅ **Maintainable** - Easy to add new languages
6. ✅ **User-friendly** - Errors in user's preferred language

---

## Pattern for Other Modules

This pattern can be applied to other modules (users, auth, etc.):

### Step 1: Add Translation Function Type to Service

```typescript
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
```

### Step 2: Add `t: TranslateFn` Parameter to Service Methods

```typescript
async createItem(
  input: CreateInput,
  requestingUserId: string,
  requestingUserPermissions: string[],
  clinicId: string,
  t: TranslateFn  // ← Add this
) {
  // Use t() for error messages
  if (!user) throw new NotFoundError(t("items.userNotFound"));
}
```

### Step 3: Pass `req.t` from Controller

```typescript
async create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await itemService.createItem(
      req.body,
      req.user!.userId,
      req.user!.permissions,
      req.user!.clinicId,
      req.t  // ← Pass translation function
    );
    sendCreated(res, result, req.t("items.created"));
  } catch (err) {
    next(err);
  }
}
```

### Step 4: Add Translation Keys to Locale Files

```json
{
  "items": {
    "retrieved": "Items retrieved",
    "created": "Item created successfully",
    "notFound": "Item not found",
    ...
  }
}
```

---

## Files Modified

1. ✅ `api/src/modules/appointments/appointment.service.ts`
   - Added `TranslateFn` type
   - Updated all methods to accept `t` parameter
   - Replaced all hardcoded error messages with translation keys

2. ✅ `api/src/modules/appointments/appointment.controller.ts`
   - Updated all methods to pass `req.t` to service

---

## Verification

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
# Test English
curl -H "X-Language: en" -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/appointments

# Test Arabic
curl -H "X-Language: ar" -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/appointments

# Test French
curl -H "X-Language: fr" -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/appointments

# Test Spanish
curl -H "X-Language: es" -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/appointments

# Test German
curl -H "X-Language: de" -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/appointments
```

---

## Next Steps

### Apply to Other Modules

1. ⚠️ **Users Module** - Apply same pattern to `user.service.ts`
2. ⚠️ **Auth Module** - Apply same pattern to `auth.service.ts`
3. ⚠️ **RBAC Module** - Apply same pattern to RBAC services

### Add More Translation Keys

If new error messages are added, update all 5 locale files:
- `api/src/locales/en.json`
- `api/src/locales/ar.json`
- `api/src/locales/fr.json`
- `api/src/locales/es.json`
- `api/src/locales/de.json`

---

## Status: ✅ COMPLETE

**Appointments module fully localized with 5 languages.**

- ✅ Service methods accept translation function
- ✅ Controller passes `req.t` to service
- ✅ All error messages use translation keys
- ✅ TypeScript compilation successful
- ✅ All tests passing

**Ready for production use.**

---

**Date:** April 18, 2026  
**Module:** Appointments  
**Languages:** 5 (en, ar, fr, es, de)
