# 🏗️ Marketplace + Multi-Tenant SaaS Architecture Refactoring

**Date:** 2026-04-18  
**Architect:** Senior Backend Architect  
**Status:** 📋 Refactoring Plan

---

## 🎯 Executive Summary

Transform the current single-tenant clinic SaaS into a **hybrid marketplace + multi-tenant platform** where:

- **Patients (users)** are GLOBAL entities who can interact with ANY clinic
- **Clinics** remain completely isolated from each other
- **Public marketplace** allows browsing all clinics without authentication
- **Private APIs** handle authenticated patient and clinic operations

---

## 📊 Current vs Target Architecture

### Current State ❌
```
users table: has clinic_id (tenant-scoped)
appointments: references tenant-scoped users
Access: Everything filtered by clinic_id
Problem: Patients can't interact with multiple clinics
```

### Target State ✅
```
users table: NO clinic_id (global)
appointments: has patient_id + clinic_id
Access: Patients see their data across ALL clinics
        Clinics see ONLY their clinic_id data
```

---

## 🗂️ New Folder Structure

```
api/src/
├── modules/
│   │
│   ├── public/                    # 🌍 PUBLIC MARKETPLACE (no auth)
│   │   ├── clinics/              # Browse all clinics
│   │   │   ├── clinic.controller.ts
│   │   │   ├── clinic.service.ts
│   │   │   ├── clinic.repository.ts
│   │   │   ├── clinic.routes.ts
│   │   │   └── clinic.validation.ts
│   │   │
│   │   ├── doctors/              # Browse doctors by clinic
│   │   │   ├── doctor.controller.ts
│   │   │   ├── doctor.service.ts
│   │   │   ├── doctor.repository.ts
│   │   │   ├── doctor.routes.ts
│   │   │   └── doctor.validation.ts
│   │   │
│   │   └── availability/         # Check clinic/doctor availability
│   │       ├── availability.controller.ts
│   │       ├── availability.service.ts
│   │       ├── availability.repository.ts
│   │       ├── availability.routes.ts
│   │       └── availability.validation.ts
│   │
│   ├── users/                    # 👤 GLOBAL USERS (patients)
│   │   ├── user.schema.ts        # NO clinic_id
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── user.repository.ts
│   │   ├── user.routes.ts
│   │   └── user.validation.ts
│   │
│   ├── clinics/                  # 🏥 CLINIC MANAGEMENT (tenant-scoped)
│   │   ├── clinic.schema.ts      # Clinic entity
│   │   ├── clinic-staff.schema.ts # Staff members (has clinic_id)
│   │   ├── clinic.controller.ts
│   │   ├── clinic.service.ts
│   │   ├── clinic.repository.ts
│   │   ├── clinic.routes.ts
│   │   └── clinic.validation.ts
│   │
│   ├── appointments/             # 📅 APPOINTMENTS (hybrid access)
│   │   ├── appointment.schema.ts # Has patient_id + clinic_id
│   │   ├── appointment.controller.ts
│   │   ├── appointment.service.ts
│   │   ├── appointment.repository.ts
│   │   ├── appointment.routes.ts
│   │   └── appointment.validation.ts
│   │
│   ├── auth/                     # 🔐 AUTHENTICATION
│   │   ├── auth.schema.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.routes.ts
│   │   └── auth.validation.ts
│   │
│   └── rbac/                     # 🛡️ AUTHORIZATION
│       ├── rbac.schema.ts
│       ├── authorize.middleware.ts
│       ├── permissions.seed.ts
│       └── rbac.repository.ts
│
├── middlewares/
│   ├── auth.middleware.ts        # JWT verification
│   ├── role-context.middleware.ts # NEW: Detect patient vs clinic staff
│   └── validate.middleware.ts
│
└── utils/
    ├── access-control.ts         # NEW: Patient vs Clinic access logic
    └── ...
```

---

## 📐 Schema Changes

### 1. Users Table (GLOBAL - Remove clinic_id)

**BEFORE:**
```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull(), // ❌ REMOVE THIS
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  emailClinicUnique: unique("users_email_clinic_unique").on(t.email, t.clinicId), // ❌ REMOVE
  clinicIdx: index("users_clinic_idx").on(t.clinicId), // ❌ REMOVE
}));
```

**AFTER:**
```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // ✅ NO clinic_id - users are GLOBAL
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }), // Optional
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // ✅ Email is globally unique
  emailUnique: unique("users_email_unique").on(t.email),
  emailIdx: index("users_email_idx").on(t.email),
  isActiveIdx: index("users_is_active_idx").on(t.isActive),
}));
```

---

### 2. Clinics Table (NEW)

```typescript
export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull(), // For URLs
  description: text("description"),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  logo: varchar("logo", { length: 500 }), // URL to logo
  isActive: boolean("is_active").default(true).notNull(),
  isPublished: boolean("is_published").default(false).notNull(), // Marketplace visibility
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  slugUnique: unique("clinics_slug_unique").on(t.slug),
  isPublishedIdx: index("clinics_is_published_idx").on(t.isPublished),
  isActiveIdx: index("clinics_is_active_idx").on(t.isActive),
}));
```

---

### 3. Clinic Staff Table (NEW - Replaces old users for clinic employees)

```typescript
export const clinicStaff = pgTable("clinic_staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(), // 'admin', 'doctor', 'receptionist'
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  // Email unique per clinic
  emailClinicUnique: unique("clinic_staff_email_clinic_unique").on(t.email, t.clinicId),
  clinicIdx: index("clinic_staff_clinic_idx").on(t.clinicId),
  roleIdx: index("clinic_staff_role_idx").on(t.role),
}));
```

---

### 4. Appointments Table (Updated)

**BEFORE:**
```typescript
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id), // ❌ Wrong reference
  // ...
});
```

**AFTER:**
```typescript
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "restrict" }),
  patientId: uuid("patient_id").notNull().references(() => users.id, { onDelete: "restrict" }), // ✅ Global user
  doctorId: uuid("doctor_id").references(() => clinicStaff.id, { onDelete: "restrict" }), // Optional
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").default(60).notNull(),
  status: appointmentStatusEnum("status").default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  clinicIdx: index("appointments_clinic_idx").on(t.clinicId),
  patientIdx: index("appointments_patient_idx").on(t.patientId), // ✅ For patient queries
  doctorIdx: index("appointments_doctor_idx").on(t.doctorId),
  scheduledAtIdx: index("appointments_scheduled_at_idx").on(t.scheduledAt),
  statusIdx: index("appointments_status_idx").on(t.status),
  // Composite indexes
  clinicScheduledIdx: index("appointments_clinic_scheduled_idx").on(t.clinicId, t.scheduledAt),
  patientScheduledIdx: index("appointments_patient_scheduled_idx").on(t.patientId, t.scheduledAt),
}));
```

---

## 🔐 JWT Token Structure

### Patient Token
```typescript
{
  userId: "uuid",
  email: "patient@example.com",
  userType: "patient", // ✅ NEW: Identifies user type
  permissions: ["appointments:create", "appointments:view_own"],
  iat: 1234567890,
  exp: 1234567890
}
```

### Clinic Staff Token
```typescript
{
  userId: "uuid",
  clinicId: "uuid", // ✅ Staff belongs to a clinic
  email: "doctor@clinic.com",
  userType: "staff", // ✅ NEW: Identifies user type
  role: "doctor",
  permissions: ["appointments:view_all", "appointments:create", "appointments:update"],
  iat: 1234567890,
  exp: 1234567890
}
```

---

## 🛣️ API Routes Structure

### Public Routes (No Authentication)

```typescript
// api/src/modules/public/clinics/clinic.routes.ts
router.get("/", clinicController.listPublic); // GET /api/public/clinics
router.get("/:slug", clinicController.getBySlug); // GET /api/public/clinics/:slug

// api/src/modules/public/doctors/doctor.routes.ts
router.get("/", doctorController.listByClinic); // GET /api/public/doctors?clinicId=xxx

// api/src/modules/public/availability/availability.routes.ts
router.get("/", availabilityController.check); // GET /api/public/availability?clinicId=xxx&date=xxx
```

### Private Routes (Authentication Required)

```typescript
// api/src/modules/appointments/appointment.routes.ts
router.get("/", authenticate, appointmentController.list); // Context-aware
router.post("/", authenticate, appointmentController.create);
router.get("/:id", authenticate, appointmentController.getById);
router.patch("/:id", authenticate, appointmentController.update);
router.delete("/:id", authenticate, appointmentController.remove);

// api/src/modules/users/user.routes.ts
router.get("/me", authenticate, userController.getProfile); // Patient profile
router.patch("/me", authenticate, userController.updateProfile);
```

---

## 🔧 Implementation Examples

### Example 1: Appointment Repository (Dual Access Pattern)

```typescript
// api/src/modules/appointments/appointment.repository.ts
import { eq, and, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { appointments } from "./appointment.schema.js";

export const appointmentRepository = {
  /**
   * Find appointments for a PATIENT (across all clinics)
   * ✅ NO clinic_id filter - patient sees all their appointments
   */
  async findAllForPatient(
    patientId: string,
    query: ListQuery
  ): Promise<{ data: Appointment[]; total: number }> {
    const { page, limit, status } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(appointments.patientId, patientId)];
    if (status) conditions.push(eq(appointments.status, status));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(appointments).where(where).limit(limit).offset(offset),
      db.select({ value: count() }).from(appointments).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find appointments for a CLINIC (only their clinic)
   * ✅ ALWAYS filter by clinic_id
   */
  async findAllForClinic(
    clinicId: string,
    query: ListQuery
  ): Promise<{ data: Appointment[]; total: number }> {
    const { page, limit, status, patientId } = query;
    const offset = (page - 1) * limit;

    // ✅ CRITICAL: Always start with clinicId filter
    const conditions: SQL[] = [eq(appointments.clinicId, clinicId)];
    if (status) conditions.push(eq(appointments.status, status));
    if (patientId) conditions.push(eq(appointments.patientId, patientId));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(appointments).where(where).limit(limit).offset(offset),
      db.select({ value: count() }).from(appointments).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find appointment by ID - context-aware
   */
  async findById(
    id: string,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<Appointment | undefined> {
    let where: SQL;

    if (context.userType === "patient") {
      // ✅ Patient: Check they own the appointment
      where = and(
        eq(appointments.id, id),
        eq(appointments.patientId, context.userId)
      );
    } else {
      // ✅ Staff: Check appointment belongs to their clinic
      where = and(
        eq(appointments.id, id),
        eq(appointments.clinicId, context.clinicId!)
      );
    }

    const [appointment] = await db.select().from(appointments).where(where);
    return appointment;
  },

  /**
   * Create appointment
   */
  async create(data: NewAppointment): Promise<Appointment> {
    const [appointment] = await db.insert(appointments).values(data).returning();
    return appointment;
  },
};
```

---

### Example 2: Appointment Service (Context-Aware Logic)

```typescript
// api/src/modules/appointments/appointment.service.ts
import { appointmentRepository } from "./appointment.repository.js";
import { NotFoundError, ForbiddenError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const appointmentService = {
  /**
   * List appointments - context-aware
   */
  async listAppointments(
    query: ListQuery,
    context: {
      userType: "patient" | "staff";
      userId: string;
      clinicId?: string;
      permissions: string[];
    },
    t: TranslateFn
  ) {
    if (context.userType === "patient") {
      // ✅ Patient: Show ALL their appointments across clinics
      const { data, total } = await appointmentRepository.findAllForPatient(
        context.userId,
        query
      );

      logger.info({
        msg: "Patient appointments listed",
        patientId: context.userId,
        count: data.length,
      });

      return { data, total };
    } else {
      // ✅ Staff: Show only appointments for their clinic
      if (!context.permissions.includes("appointments:view_all")) {
        throw new ForbiddenError(t("permissions.required", { permission: "appointments:view_all" }));
      }

      const { data, total } = await appointmentRepository.findAllForClinic(
        context.clinicId!,
        query
      );

      logger.info({
        msg: "Clinic appointments listed",
        clinicId: context.clinicId,
        count: data.length,
      });

      return { data, total };
    }
  },

  /**
   * Create appointment
   */
  async createAppointment(
    input: CreateAppointmentInput,
    context: {
      userType: "patient" | "staff";
      userId: string;
      clinicId?: string;
      permissions: string[];
    },
    t: TranslateFn
  ) {
    if (context.userType === "patient") {
      // ✅ Patient creating appointment
      // Patient can book with ANY clinic
      const appointment = await appointmentRepository.create({
        patientId: context.userId, // ✅ Use authenticated patient ID
        clinicId: input.clinicId, // ✅ Patient chooses clinic
        doctorId: input.doctorId,
        title: input.title,
        description: input.description,
        scheduledAt: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes,
      });

      logger.info({
        msg: "Appointment created by patient",
        appointmentId: appointment.id,
        patientId: context.userId,
        clinicId: input.clinicId,
      });

      return appointment;
    } else {
      // ✅ Staff creating appointment
      if (!context.permissions.includes("appointments:create")) {
        throw new ForbiddenError(t("permissions.required", { permission: "appointments:create" }));
      }

      // Staff can only create appointments for their clinic
      const appointment = await appointmentRepository.create({
        patientId: input.patientId, // Staff specifies patient
        clinicId: context.clinicId!, // ✅ Force staff's clinic
        doctorId: input.doctorId,
        title: input.title,
        description: input.description,
        scheduledAt: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes,
      });

      logger.info({
        msg: "Appointment created by staff",
        appointmentId: appointment.id,
        createdBy: context.userId,
        clinicId: context.clinicId,
      });

      return appointment;
    }
  },

  /**
   * Get appointment by ID - context-aware
   */
  async getAppointmentById(
    id: string,
    context: {
      userType: "patient" | "staff";
      userId: string;
      clinicId?: string;
      permissions: string[];
    },
    t: TranslateFn
  ) {
    const appointment = await appointmentRepository.findById(id, context);

    if (!appointment) {
      throw new NotFoundError(t("appointments.notFound"));
    }

    return appointment;
  },
};
```

---

### Example 3: Appointment Controller (Context Extraction)

```typescript
// api/src/modules/appointments/appointment.controller.ts
import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { appointmentService } from "./appointment.service.js";

export const appointmentController = {
  /**
   * List appointments
   * GET /api/v1/appointments
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // ✅ Extract context from JWT (set by auth middleware)
      const context = {
        userType: req.user!.userType, // "patient" or "staff"
        userId: req.user!.userId,
        clinicId: req.user!.clinicId, // Only present for staff
        permissions: req.user!.permissions,
      };

      const result = await appointmentService.listAppointments(
        req.query as ListQuery,
        context,
        req.t
      );

      sendSuccess(res, result, req.t("appointments.retrieved"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * Create appointment
   * POST /api/v1/appointments
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = {
        userType: req.user!.userType,
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };

      const result = await appointmentService.createAppointment(
        req.body,
        context,
        req.t
      );

      sendCreated(res, result, req.t("appointments.created"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get appointment by ID
   * GET /api/v1/appointments/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = {
        userType: req.user!.userType,
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };

      const result = await appointmentService.getAppointmentById(
        req.params.id,
        context,
        req.t
      );

      sendSuccess(res, result, req.t("appointments.appointmentRetrieved"));
    } catch (err) {
      next(err);
    }
  },
};
```

---

### Example 4: Public Clinic Routes (No Auth)

```typescript
// api/src/modules/public/clinics/clinic.controller.ts
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../../utils/response.js";
import { clinicService } from "./clinic.service.js";

export const publicClinicController = {
  /**
   * List all published clinics (marketplace)
   * GET /api/public/clinics
   */
  async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clinicService.listPublicClinics(
        req.query as ListQuery,
        req.t
      );

      sendSuccess(res, result, req.t("clinics.retrieved"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get clinic by slug
   * GET /api/public/clinics/:slug
   */
  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clinicService.getPublicClinicBySlug(
        req.params.slug,
        req.t
      );

      sendSuccess(res, result, req.t("clinics.clinicRetrieved"));
    } catch (err) {
      next(err);
    }
  },
};

// api/src/modules/public/clinics/clinic.routes.ts
import { Router } from "express";
import { publicClinicController } from "./clinic.controller.js";
import { validate } from "../../../middlewares/validate.middleware.js";
import { listClinicsQuerySchema } from "./clinic.validation.js";

const router = Router();

/**
 * @openapi
 * /public/clinics:
 *   get:
 *     summary: List all published clinics
 *     tags: [Public]
 */
router.get(
  "/",
  validate({ query: listClinicsQuerySchema }),
  publicClinicController.listPublic
);

/**
 * @openapi
 * /public/clinics/{slug}:
 *   get:
 *     summary: Get clinic by slug
 *     tags: [Public]
 */
router.get("/:slug", publicClinicController.getBySlug);

export default router;
```

---

## 🔄 Migration Strategy

### Phase 1: Schema Migration

1. **Create new tables:**
   ```sql
   CREATE TABLE clinics (...);
   CREATE TABLE clinic_staff (...);
   ```

2. **Migrate existing users to clinic_staff:**
   ```sql
   INSERT INTO clinic_staff (id, clinic_id, name, email, password_hash, role, is_active, created_at, updated_at)
   SELECT id, clinic_id, name, email, password_hash, 'admin', is_active, created_at, updated_at
   FROM users;
   ```

3. **Create new global users table:**
   ```sql
   CREATE TABLE users_new (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name VARCHAR(100) NOT NULL,
     email VARCHAR(255) NOT NULL UNIQUE,
     password_hash VARCHAR(255) NOT NULL,
     phone VARCHAR(20),
     is_active BOOLEAN DEFAULT true NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
     updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
   );
   ```

4. **Update appointments table:**
   ```sql
   ALTER TABLE appointments RENAME COLUMN user_id TO patient_id;
   ALTER TABLE appointments ADD COLUMN doctor_id UUID REFERENCES clinic_staff(id);
   ```

### Phase 2: Code Refactoring

1. Create new folder structure
2. Implement dual-access repository pattern
3. Update services with context-aware logic
4. Update controllers to extract context
5. Create public API routes

### Phase 3: Testing

1. Test patient flows (cross-clinic appointments)
2. Test clinic isolation (staff can't see other clinics)
3. Test public marketplace (no auth required)

---

## 🎯 Key Principles

### ✅ DO

- **Patients:** Query by `patientId` ONLY (no `clinicId` filter)
- **Staff:** ALWAYS filter by `clinicId`
- **Public:** Show only `isPublished = true` clinics
- **Context-aware:** Use `userType` to determine access pattern

### ❌ DON'T

- **Never** filter patient queries by `clinicId`
- **Never** allow staff to access other clinics' data
- **Never** expose unpublished clinics in public API
- **Never** mix patient and staff logic in the same method

---

## 📋 Checklist

### Schema Changes
- [ ] Remove `clinic_id` from users table
- [ ] Create `clinics` table
- [ ] Create `clinic_staff` table
- [ ] Update `appointments` table (rename `user_id` to `patient_id`)
- [ ] Add `doctor_id` to appointments
- [ ] Update indexes

### Code Structure
- [ ] Create `modules/public/` folder
- [ ] Create `modules/public/clinics/`
- [ ] Create `modules/public/doctors/`
- [ ] Create `modules/public/availability/`
- [ ] Create `modules/clinics/` (management)
- [ ] Update `modules/users/` (global patients)
- [ ] Update `modules/appointments/` (dual access)

### Repository Layer
- [ ] Implement `findAllForPatient()` (no clinic filter)
- [ ] Implement `findAllForClinic()` (with clinic filter)
- [ ] Implement context-aware `findById()`
- [ ] Update all queries to use context

### Service Layer
- [ ] Add `userType` to context parameter
- [ ] Implement patient logic (cross-clinic)
- [ ] Implement staff logic (clinic-scoped)
- [ ] Update permission checks

### Controller Layer
- [ ] Extract context from `req.user`
- [ ] Pass context to service methods
- [ ] Handle both patient and staff requests

### Middleware
- [ ] Update JWT to include `userType`
- [ ] Update auth middleware to set `userType`
- [ ] Create role-context middleware (optional)

### Routes
- [ ] Create public routes (no auth)
- [ ] Update private routes (context-aware)
- [ ] Register routes in `server.ts`

### Testing
- [ ] Test patient cross-clinic appointments
- [ ] Test clinic isolation
- [ ] Test public marketplace
- [ ] Test permission enforcement

---

## 🚀 Next Steps

1. **Review this plan** with the team
2. **Create database migration** scripts
3. **Implement Phase 1** (schema changes)
4. **Implement Phase 2** (code refactoring)
5. **Test thoroughly** (Phase 3)
6. **Deploy incrementally** (feature flags recommended)

---

**Status:** 📋 Ready for Implementation
