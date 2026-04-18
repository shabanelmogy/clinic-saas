# 🚀 Quick Reference - Marketplace Architecture

**For:** Developers implementing marketplace features  
**Date:** 2026-04-18

---

## 🎯 Core Concepts

| Concept | Description |
|---------|-------------|
| **Global Users** | Patients with NO `clinic_id` - can interact with ANY clinic |
| **Clinic Staff** | Employees with `clinic_id` - scoped to their clinic |
| **Hybrid Access** | Appointments have both `patient_id` (global) and `clinic_id` (tenant) |
| **Context-Aware** | Repository/service methods behave differently for patients vs staff |

---

## 📊 Data Model

```
users (GLOBAL)
├── id
├── name
├── email (globally unique)
├── passwordHash
└── NO clinic_id ✅

clinics
├── id
├── name
├── slug
├── isPublished (marketplace visibility)
└── ...

clinic_staff (TENANT-SCOPED)
├── id
├── clinic_id ✅
├── name
├── email (unique per clinic)
├── role
└── ...

appointments (HYBRID)
├── id
├── patient_id → users.id (global)
├── clinic_id → clinics.id (tenant)
├── doctor_id → clinic_staff.id
└── ...
```

---

## 🔑 JWT Token Structure

### Patient Token
```json
{
  "userId": "uuid",
  "email": "patient@example.com",
  "userType": "patient",
  "permissions": ["appointments:create", "appointments:view_own"]
}
```

### Staff Token
```json
{
  "userId": "uuid",
  "clinicId": "uuid",
  "email": "doctor@clinic.com",
  "userType": "staff",
  "role": "doctor",
  "permissions": ["appointments:view_all", "appointments:create"]
}
```

---

## 🛣️ API Routes

### Public (No Auth)
```
GET    /api/public/clinics              # List all published clinics
GET    /api/public/clinics/:slug        # Get clinic by slug
GET    /api/public/doctors?clinicId=x   # List doctors by clinic
GET    /api/public/availability?...     # Check availability
```

### Private (Auth Required)
```
# Appointments (context-aware)
GET    /api/v1/appointments              # Patient: all clinics, Staff: their clinic
POST   /api/v1/appointments              # Patient: any clinic, Staff: their clinic
GET    /api/v1/appointments/:id          # Context-aware access
PATCH  /api/v1/appointments/:id          # Context-aware access
DELETE /api/v1/appointments/:id          # Context-aware access

# Users (patients only)
GET    /api/v1/users/me                  # Get own profile
PATCH  /api/v1/users/me                  # Update own profile
```

---

## 🔍 Query Patterns

### ✅ Patient Queries (Cross-Clinic)

```typescript
// List patient's appointments (ALL clinics)
const appointments = await db
  .select()
  .from(appointments)
  .where(eq(appointments.patientId, patientId))
  .orderBy(appointments.scheduledAt);

// Get patient's appointment by ID
const appointment = await db
  .select()
  .from(appointments)
  .where(and(
    eq(appointments.id, appointmentId),
    eq(appointments.patientId, patientId) // ✅ Only check patient ownership
  ));
```

### ✅ Staff Queries (Clinic-Scoped)

```typescript
// List clinic's appointments
const appointments = await db
  .select()
  .from(appointments)
  .where(eq(appointments.clinicId, clinicId)) // ✅ ALWAYS filter by clinic
  .orderBy(appointments.scheduledAt);

// Get clinic's appointment by ID
const appointment = await db
  .select()
  .from(appointments)
  .where(and(
    eq(appointments.id, appointmentId),
    eq(appointments.clinicId, clinicId) // ✅ ALWAYS filter by clinic
  ));
```

### ✅ Public Queries (Marketplace)

```typescript
// List published clinics
const clinics = await db
  .select()
  .from(clinics)
  .where(and(
    eq(clinics.isPublished, true), // ✅ Only published
    eq(clinics.isActive, true)
  ));
```

---

## 🎨 Repository Pattern

```typescript
export const appointmentRepository = {
  // For PATIENTS - no clinic filter
  async findAllForPatient(patientId: string, query: ListQuery) {
    const conditions = [eq(appointments.patientId, patientId)];
    // ✅ NO clinic_id filter
    // ...
  },

  // For STAFF - always filter by clinic
  async findAllForClinic(clinicId: string, query: ListQuery) {
    const conditions = [eq(appointments.clinicId, clinicId)];
    // ✅ ALWAYS include clinic_id filter
    // ...
  },

  // Context-aware access
  async findById(id: string, context: Context) {
    if (context.userType === "patient") {
      // Check patient ownership
      return db.select().from(appointments).where(and(
        eq(appointments.id, id),
        eq(appointments.patientId, context.userId)
      ));
    } else {
      // Check clinic ownership
      return db.select().from(appointments).where(and(
        eq(appointments.id, id),
        eq(appointments.clinicId, context.clinicId!)
      ));
    }
  },
};
```

---

## 🧩 Service Pattern

```typescript
export const appointmentService = {
  async listAppointments(query: ListQuery, context: Context, t: TranslateFn) {
    if (context.userType === "patient") {
      // ✅ Patient: Show ALL their appointments (cross-clinic)
      return appointmentRepository.findAllForPatient(context.userId, query);
    } else {
      // ✅ Staff: Show only their clinic's appointments
      return appointmentRepository.findAllForClinic(context.clinicId!, query);
    }
  },

  async createAppointment(input: CreateInput, context: Context, t: TranslateFn) {
    if (context.userType === "patient") {
      // ✅ Patient: Can book with ANY clinic
      return appointmentRepository.create({
        patientId: context.userId,
        clinicId: input.clinicId, // Patient chooses clinic
        // ...
      });
    } else {
      // ✅ Staff: Can only create for their clinic
      return appointmentRepository.create({
        patientId: input.patientId,
        clinicId: context.clinicId!, // Force staff's clinic
        // ...
      });
    }
  },
};
```

---

## 🎭 Controller Pattern

```typescript
export const appointmentController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      // ✅ Extract context from JWT
      const context = {
        userType: req.user!.userType,
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };

      const result = await appointmentService.listAppointments(
        req.query,
        context,
        req.t
      );

      sendSuccess(res, result, req.t("appointments.retrieved"));
    } catch (err) {
      next(err);
    }
  },
};
```

---

## ⚠️ Critical Rules

### ✅ DO

| Rule | Example |
|------|---------|
| **Patient queries:** Filter by `patientId` ONLY | `where(eq(appointments.patientId, patientId))` |
| **Staff queries:** ALWAYS filter by `clinicId` | `where(eq(appointments.clinicId, clinicId))` |
| **Public queries:** Only show `isPublished = true` | `where(eq(clinics.isPublished, true))` |
| **Context-aware:** Use `userType` to determine logic | `if (context.userType === "patient")` |
| **JWT tokens:** Include `userType` field | `{ userType: "patient" \| "staff" }` |

### ❌ DON'T

| Rule | Why |
|------|-----|
| **Never** filter patient queries by `clinicId` | Patients see appointments across ALL clinics |
| **Never** allow staff to access other clinics | Violates tenant isolation |
| **Never** expose unpublished clinics in public API | Privacy/security concern |
| **Never** mix patient and staff logic | Use context-aware branching |
| **Never** trust `clinicId` from request body for staff | Always use JWT `clinicId` |

---

## 🧪 Testing Checklist

### Patient Tests
- [ ] Patient can create appointment with Clinic A
- [ ] Patient can create appointment with Clinic B
- [ ] Patient sees both appointments in list
- [ ] Patient can view appointment from any clinic
- [ ] Patient cannot view other patients' appointments

### Staff Tests
- [ ] Staff can only see their clinic's appointments
- [ ] Staff cannot access other clinics' appointments
- [ ] Staff can create appointments for their clinic
- [ ] Staff cannot create appointments for other clinics
- [ ] Staff cannot modify other clinics' appointments

### Public Tests
- [ ] Public can browse published clinics
- [ ] Public cannot see unpublished clinics
- [ ] Public can view clinic details by slug
- [ ] Public can browse doctors by clinic
- [ ] Public endpoints work without authentication

---

## 🐛 Common Mistakes

### ❌ Mistake 1: Filtering Patient Queries by Clinic

```typescript
// ❌ WRONG
const appointments = await db
  .select()
  .from(appointments)
  .where(and(
    eq(appointments.patientId, patientId),
    eq(appointments.clinicId, clinicId) // ❌ NO! Patient sees all clinics
  ));

// ✅ CORRECT
const appointments = await db
  .select()
  .from(appointments)
  .where(eq(appointments.patientId, patientId)); // ✅ Only patient filter
```

---

### ❌ Mistake 2: Missing Clinic Filter for Staff

```typescript
// ❌ WRONG
const appointments = await db
  .select()
  .from(appointments)
  .where(eq(appointments.status, "pending")); // ❌ NO! Missing clinic filter

// ✅ CORRECT
const appointments = await db
  .select()
  .from(appointments)
  .where(and(
    eq(appointments.clinicId, clinicId), // ✅ ALWAYS include
    eq(appointments.status, "pending")
  ));
```

---

### ❌ Mistake 3: Trusting clinicId from Request Body

```typescript
// ❌ WRONG
const appointment = await appointmentRepository.create({
  clinicId: req.body.clinicId, // ❌ User could provide any clinic ID
  // ...
});

// ✅ CORRECT
const appointment = await appointmentRepository.create({
  clinicId: req.user!.clinicId, // ✅ Use JWT clinicId (for staff)
  // ...
});
```

---

### ❌ Mistake 4: Showing Unpublished Clinics

```typescript
// ❌ WRONG
const clinics = await db
  .select()
  .from(clinics)
  .where(eq(clinics.isActive, true)); // ❌ Missing isPublished check

// ✅ CORRECT
const clinics = await db
  .select()
  .from(clinics)
  .where(and(
    eq(clinics.isPublished, true), // ✅ Only published
    eq(clinics.isActive, true)
  ));
```

---

## 📚 File Locations

```
api/src/
├── modules/
│   ├── public/                          # Public marketplace
│   │   ├── clinics/
│   │   ├── doctors/
│   │   └── availability/
│   │
│   ├── users/                           # Global patients
│   │   └── user.schema.ts               # NO clinic_id
│   │
│   ├── clinics/                         # Clinic management
│   │   └── clinic.schema.ts             # clinics + clinic_staff
│   │
│   └── appointments/                    # Hybrid access
│       ├── appointment.schema.ts        # patient_id + clinic_id
│       ├── appointment.repository.ts    # Dual access methods
│       ├── appointment.service.ts       # Context-aware logic
│       └── appointment.controller.ts    # Context extraction
│
└── types/
    └── express.d.ts                     # Add userType to req.user
```

---

## 🔗 Related Documentation

- **Architecture Plan:** `MARKETPLACE_ARCHITECTURE.md`
- **Implementation Examples:** `IMPLEMENTATION_EXAMPLES.md`
- **Migration Guide:** `MIGRATION_GUIDE.md`
- **Localization:** `LOCALIZATION_FINAL_STATUS.md`

---

**Status:** ✅ Ready for Development
