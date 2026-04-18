# Module Creation Guide - Marketplace Architecture

Based on the **appointments** module implementation.

---

## 📋 Quick Decision Tree

### Step 1: Determine Entity Type

**Is this entity GLOBAL (shared across all clinics)?**
- Examples: Users, Auth tokens
- ✅ NO `clinicId` column
- ✅ Email/username globally unique
- ✅ Repository methods have NO `clinicId` parameter
- → Use **Global Entity Pattern** (see users module)

**Is this entity CLINIC-OWNED (belongs to one clinic)?**
- Examples: Services, Staff, Schedules
- ✅ HAVE `clinicId` column
- ✅ Always filtered by `clinicId`
- ✅ Repository methods ALWAYS accept `clinicId` parameter
- → Use **Clinic-Owned Entity Pattern** (future modules)

**Is this entity HYBRID (connects global and clinic entities)?**
- Examples: Appointments (connect patients to clinics)
- ✅ HAVE both `patientId` (global) and `clinicId` (clinic-owned)
- ✅ Dual-access pattern (patient vs staff)
- ✅ Context-aware repository methods
- → Use **Hybrid Entity Pattern** (see appointments module)

---

## 🏗️ Module Structure

Every module has 6 files:

```
api/src/modules/<name>/
├── <name>.schema.ts       # Database schema
├── <name>.validation.ts   # Zod validation schemas
├── <name>.repository.ts   # Database queries
├── <name>.service.ts      # Business logic
├── <name>.controller.ts   # HTTP handlers
└── <name>.routes.ts       # Route definitions
```

---

## 1️⃣ Schema (`<name>.schema.ts`)

### Hybrid Entity Example (Appointments)

```typescript
import { pgTable, uuid, varchar, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "../users/user.schema.js";
import { clinics } from "../clinics/clinic.schema.js";

// Define enums
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

// Define table
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // ✅ Clinic-owned: which clinic owns this appointment
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),
    
    // ✅ Global patient: NOT scoped to a clinic
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    
    title: varchar("title", { length: 200 }).notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: appointmentStatusEnum("status").default("pending").notNull(),
    
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Indexes for clinic-side queries
    clinicIdx: index("appointments_clinic_idx").on(t.clinicId),
    clinicScheduledIdx: index("appointments_clinic_scheduled_idx").on(t.clinicId, t.scheduledAt),
    
    // Indexes for patient-side queries
    patientIdx: index("appointments_patient_idx").on(t.patientId),
    patientScheduledIdx: index("appointments_patient_scheduled_idx").on(t.patientId, t.scheduledAt),
    
    // General indexes
    scheduledAtIdx: index("appointments_scheduled_at_idx").on(t.scheduledAt),
    statusIdx: index("appointments_status_idx").on(t.status),
  })
);

// Export types
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
```

### ✅ Schema Checklist

- [ ] Use `uuid("id").primaryKey().defaultRandom()` for ID
- [ ] Add `createdAt` and `updatedAt` timestamps with `{ withTimezone: true }`
- [ ] Use `pgEnum` for fixed value sets (status, type, role)
- [ ] Import tables from module schemas, NOT from `db/schema.ts`
- [ ] Use `.references()` with `onDelete: "restrict"` for all FKs
- [ ] Add indexes on ALL foreign keys
- [ ] Add indexes on columns used in WHERE clauses
- [ ] Add composite indexes for common query patterns
- [ ] Export types: `Type` and `NewType`
- [ ] Register in `src/db/schema.ts`: `export * from "../modules/<name>/<name>.schema.js";`

---

## 2️⃣ Validation (`<name>.validation.ts`)

### Factory Function Pattern (Required for i18n)

```typescript
import { z } from "zod";
import { paginationSchema } from "../../utils/shared-validators.js";
import { appointmentStatusEnum } from "./appointment.schema.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const createAppointmentSchemas = (t: TranslateFn) => ({
  create: z.object({
    // Optional fields - service enforces based on userType
    patientId: z.string().uuid(t("validation.invalidUuid")).optional(),
    clinicId: z.string().uuid(t("validation.invalidUuid")).optional(),
    
    title: z
      .string()
      .min(2, t("validation.minLength", { field: "Title", min: 2 }))
      .max(200, t("validation.maxLength", { field: "Title", max: 200 })),
    
    scheduledAt: z
      .string()
      .datetime({ message: t("validation.appointments.invalidDatetime") })
      .refine((val: string) => new Date(val) > new Date(), {
        message: t("validation.appointments.mustBeFuture"),
      }),
    
    status: z.enum(appointmentStatusEnum.enumValues),
  }),

  update: z.object({
    title: z.string().min(2, t("validation.minLength", { field: "Title", min: 2 })).optional(),
    status: z.enum(appointmentStatusEnum.enumValues).optional(),
    // All fields optional for PATCH semantics
  }),

  listQuery: paginationSchema.extend({
    patientId: z.string().uuid(t("validation.invalidUuid")).optional(),
    status: z.enum(appointmentStatusEnum.enumValues).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
});

// Export types using factory return types
export type CreateAppointmentInput = z.infer<ReturnType<typeof createAppointmentSchemas>["create"]>;
export type UpdateAppointmentInput = z.infer<ReturnType<typeof createAppointmentSchemas>["update"]>;
export type ListAppointmentsQuery = z.infer<ReturnType<typeof createAppointmentSchemas>["listQuery"]>;
```

### ✅ Validation Checklist

- [ ] Define `TranslateFn` type
- [ ] Create factory function `create<Name>Schemas(t: TranslateFn)`
- [ ] Use translation keys for ALL error messages
- [ ] Extend `paginationSchema` from shared-validators
- [ ] Derive enum values from schema: `z.enum(statusEnum.enumValues)`
- [ ] Use `z.string().uuid()` for UUID fields
- [ ] Use `z.coerce.number()` for numeric query params
- [ ] Export types using factory return types
- [ ] Create separate schemas: `create`, `update`, `listQuery`

---

## 3️⃣ Repository (`<name>.repository.ts`)

### Hybrid Entity Pattern (Dual Access)

```typescript
import { eq, and, count, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { appointments, type Appointment, type NewAppointment } from "./appointment.schema.js";

export const appointmentRepository = {
  /**
   * Find appointments for a PATIENT across ALL clinics.
   * ✅ Filters by patientId ONLY — cross-clinic visibility
   */
  async findAllForPatient(
    patientId: string,
    query: ListQuery
  ): Promise<{ data: Appointment[]; total: number }> {
    const { page, limit, status } = query;
    const offset = (page - 1) * limit;

    // ✅ CRITICAL: Only filter by patientId — no clinicId
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
   * Find appointments for a CLINIC — strictly scoped.
   * ✅ ALWAYS filters by clinicId — tenant isolation
   */
  async findAllForClinic(
    clinicId: string,
    query: ListQuery
  ): Promise<{ data: Appointment[]; total: number }> {
    const { page, limit, patientId, status } = query;
    const offset = (page - 1) * limit;

    // ✅ CRITICAL: Always start with clinicId filter
    const conditions: SQL[] = [eq(appointments.clinicId, clinicId)];
    if (patientId) conditions.push(eq(appointments.patientId, patientId));
    if (status) conditions.push(eq(appointments.status, status));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(appointments).where(where).limit(limit).offset(offset),
      db.select({ value: count() }).from(appointments).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find by ID — context-aware.
   * Patient: checks ownership via patientId
   * Staff: checks ownership via clinicId
   */
  async findById(
    id: string,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<Appointment | undefined> {
    const where =
      context.userType === "patient"
        ? and(eq(appointments.id, id), eq(appointments.patientId, context.userId))
        : and(eq(appointments.id, id), eq(appointments.clinicId, context.clinicId!));

    const [appointment] = await db.select().from(appointments).where(where);
    return appointment;
  },

  /**
   * Create appointment.
   */
  async create(data: NewAppointment): Promise<Appointment> {
    const [appointment] = await db.insert(appointments).values(data).returning();
    return appointment;
  },

  /**
   * Update appointment — context-aware.
   */
  async update(
    id: string,
    data: Partial<NewAppointment>,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<Appointment | undefined> {
    const where =
      context.userType === "patient"
        ? and(eq(appointments.id, id), eq(appointments.patientId, context.userId))
        : and(eq(appointments.id, id), eq(appointments.clinicId, context.clinicId!));

    const [appointment] = await db
      .update(appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(where)
      .returning();
    return appointment;
  },

  /**
   * Delete appointment — context-aware.
   */
  async delete(
    id: string,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<boolean> {
    const where =
      context.userType === "patient"
        ? and(eq(appointments.id, id), eq(appointments.patientId, context.userId))
        : and(eq(appointments.id, id), eq(appointments.clinicId, context.clinicId!));

    const result = await db.delete(appointments).where(where).returning();
    return result.length > 0;
  },

  /**
   * Count for dependency checks.
   */
  async countByPatientId(patientId: string): Promise<number> {
    const [{ value }] = await db
      .select({ value: count() })
      .from(appointments)
      .where(eq(appointments.patientId, patientId));
    return Number(value);
  },
};
```

### ✅ Repository Checklist

- [ ] Import table from module schema, NOT from `db/schema.ts`
- [ ] Return `{ data, total }` for list methods
- [ ] Run count query in parallel with `Promise.all`
- [ ] Use `and(...conditions)` for multiple filters
- [ ] Return `T | undefined` for findById (don't throw)
- [ ] Use `.returning()` for create/update/delete
- [ ] Set `updatedAt: new Date()` explicitly on updates
- [ ] For hybrid entities: create separate methods for each access pattern

---

## 4️⃣ Service (`<name>.service.ts`)

### Context-Aware Service Pattern

```typescript
import { appointmentRepository } from "./appointment.repository.js";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const requirePermission = (
  userPermissions: string[],
  permission: string,
  t: TranslateFn
): void => {
  if (!userPermissions.includes(permission)) {
    throw new ForbiddenError(t("permissions.required", { permission }));
  }
};

export const appointmentService = {
  /**
   * List appointments — context-aware.
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
      // ✅ Patient: cross-clinic visibility
      const { data, total } = await appointmentRepository.findAllForPatient(
        context.userId,
        query
      );

      logger.info({
        msg: "Patient appointments listed",
        patientId: context.userId,
        count: data.length,
      });

      return { data, total, page: query.page, limit: query.limit };
    } else {
      // ✅ Staff: clinic-scoped
      requirePermission(context.permissions, "appointments:view_all", t);

      const { data, total } = await appointmentRepository.findAllForClinic(
        context.clinicId!,
        query
      );

      logger.info({
        msg: "Clinic appointments listed",
        clinicId: context.clinicId,
        count: data.length,
      });

      return { data, total, page: query.page, limit: query.limit };
    }
  },

  /**
   * Create appointment — context-aware.
   */
  async createAppointment(
    input: CreateInput,
    context: {
      userType: "patient" | "staff";
      userId: string;
      clinicId?: string;
      permissions: string[];
    },
    t: TranslateFn
  ) {
    if (context.userType === "patient") {
      // ✅ Patient booking — must provide clinicId
      if (!input.clinicId) {
        throw new BadRequestError("clinicId is required for patient bookings");
      }

      const appointment = await appointmentRepository.create({
        patientId: context.userId, // ✅ Authenticated patient
        clinicId: input.clinicId,   // ✅ Patient chooses clinic
        ...input,
      });

      logger.info({
        msg: "Appointment created by patient",
        appointmentId: appointment.id,
        patientId: context.userId,
        clinicId: input.clinicId,
      });

      return appointment;
    } else {
      // ✅ Staff creating — must provide patientId
      requirePermission(context.permissions, "appointments:create", t);

      if (!input.patientId) {
        throw new BadRequestError("patientId is required for staff bookings");
      }

      const appointment = await appointmentRepository.create({
        patientId: input.patientId, // ✅ Staff specifies patient
        clinicId: context.clinicId!, // ✅ Staff's clinic
        ...input,
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
};
```

### ✅ Service Checklist

- [ ] Define `TranslateFn` type
- [ ] Create `requirePermission()` helper
- [ ] All methods accept `t: TranslateFn` parameter
- [ ] All error messages use translation keys
- [ ] Check permissions before operations
- [ ] Check existence before update/delete
- [ ] Check for conflicts before create
- [ ] Use `!== undefined` for falsy value checks
- [ ] Log all important actions (create, update, delete)
- [ ] Use `logger.info()` for normal ops, `logger.warn()` for deletes
- [ ] For hybrid entities: branch logic based on `context.userType`

---

## 5️⃣ Controller (`<name>.controller.ts`)

### Context Extraction Pattern

```typescript
import type { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../utils/response.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { appointmentService } from "./appointment.service.js";

export const appointmentController = {
  /**
   * List appointments — context-aware.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // ✅ Extract context from JWT
      const context = {
        userType: req.user!.userType,
        userId: req.user!.userId,
        clinicId: req.user!.clinicId,
        permissions: req.user!.permissions,
      };

      const result = await appointmentService.listAppointments(
        req.query as unknown as ListQuery,
        context,
        req.t
      );

      const meta = buildPaginationMeta(result.total, result.page, result.limit);
      sendSuccess(res, result.data, req.t("appointments.retrieved"), 200, meta);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Create appointment — context-aware.
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
        req.body as CreateInput,
        context,
        req.t
      );

      sendCreated(res, result, req.t("appointments.created"));
    } catch (err) {
      next(err);
    }
  },
};
```

### ✅ Controller Checklist

- [ ] Every method signature: `async (req, res, next): Promise<void>`
- [ ] Wrap body in `try/catch` → `next(err)`
- [ ] Use `sendSuccess` / `sendCreated` from `utils/response.ts`
- [ ] Use `buildPaginationMeta` for list responses
- [ ] Cast `req.query`, `req.body`, `req.params` to validated types
- [ ] Extract context from `req.user` for hybrid entities
- [ ] Pass `req.t` to service methods
- [ ] Use `req.t()` for success messages

---

## 6️⃣ Routes (`<name>.routes.ts`)

### Route Definition Pattern

```typescript
import { Router } from "express";
import { appointmentController } from "./appointment.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorize, authorizeAny } from "../rbac/authorize.middleware.js";
import { idParamSchema } from "../../utils/shared-validators.js";
import { createAppointmentSchemas } from "./appointment.validation.js";

const router = Router();

/**
 * @openapi
 * /appointments:
 *   get:
 *     summary: List appointments
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  authenticate,                                                    // 1. Verify JWT
  authorizeAny(["appointments:view_all", "appointments:view_own"]), // 2. Check permission
  validate({ query: (t) => createAppointmentSchemas(t).listQuery }), // 3. Validate input
  appointmentController.list                                       // 4. Handle request
);

/**
 * @openapi
 * /appointments:
 *   post:
 *     summary: Create appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  authenticate,
  authorize("appointments:create"),
  validate({ body: (t) => createAppointmentSchemas(t).create }),
  appointmentController.create
);

/**
 * @openapi
 * /appointments/{id}:
 *   patch:
 *     summary: Update appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/:id",
  authenticate,
  authorize("appointments:update"),
  validate({ 
    params: idParamSchema,
    body: (t) => createAppointmentSchemas(t).update 
  }),
  appointmentController.update
);

export default router;
```

### ✅ Routes Checklist

- [ ] Apply `authenticate` to ALL routes (except public endpoints)
- [ ] Apply RBAC authorization: `authorize()`, `authorizeAny()`, or `authorizeAll()`
- [ ] Use `validate()` middleware on every route
- [ ] Use `idParamSchema` from shared-validators for `/:id` routes
- [ ] Use factory functions in validation: `(t) => createSchemas(t).create`
- [ ] Add `@openapi` JSDoc for Swagger documentation
- [ ] Export `default router`
- [ ] Middleware order: authenticate → authorize → validate → controller

---

## 7️⃣ Register Module in `server.ts`

```typescript
import appointmentRoutes from "./modules/appointments/appointment.routes.js";

app.use("/api/v1/appointments", appointmentRoutes);
```

---

## 8️⃣ Add Translation Keys

Add to ALL 5 language files (`en.json`, `ar.json`, `fr.json`, `es.json`, `de.json`):

```json
{
  "appointments": {
    "retrieved": "Appointments retrieved",
    "appointmentRetrieved": "Appointment retrieved",
    "created": "Appointment created successfully",
    "updated": "Appointment updated successfully",
    "deleted": "Appointment deleted successfully",
    "notFound": "Appointment not found",
    "userNotFound": "User not found",
    "userInactive": "Cannot create appointment for an inactive user",
    "cannotUpdateStatus": "Cannot update appointment with status {{status}}",
    "cannotDeleteConfirmed": "Cannot delete a confirmed appointment"
  },
  "validation": {
    "appointments": {
      "invalidDatetime": "Invalid datetime format",
      "mustBeFuture": "Scheduled time must be in the future",
      "durationMustBeInteger": "Duration must be an integer"
    }
  }
}
```

---

## 9️⃣ Generate Migration

```bash
cd api
npm run db:generate
# Review migration in api/drizzle/
npm run db:migrate
```

---

## 🎯 Key Principles

1. **Context-Aware Access** - Different logic for patient vs staff
2. **Dual-Access Pattern** - Separate repository methods for each access pattern
3. **Translation Keys** - ALL user-facing messages use i18n
4. **Permission Checks** - ALWAYS check permissions in service layer
5. **Structured Logging** - Log all important actions with context
6. **Type Safety** - Use TypeScript types throughout
7. **Validation** - Validate at the edge (routes), enforce in service

---

## 📚 Reference Modules

- **Global Entity:** `api/src/modules/users/` - Users (no clinicId)
- **Hybrid Entity:** `api/src/modules/appointments/` - Appointments (dual access)
- **Clinic-Owned Entity:** Future modules (services, schedules)

---

**Date:** 2026-04-18  
**Based on:** Appointments module implementation  
**Architecture:** Marketplace + Multi-Tenant Hybrid
