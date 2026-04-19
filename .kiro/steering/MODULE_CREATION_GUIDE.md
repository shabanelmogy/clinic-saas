# Module Creation Guide - Marketplace Architecture

Based on the **appointments**, **doctors**, **patients**, and **clinics** module implementations.
Last updated: 2026-04-19

---

## 📋 Quick Decision Tree

### Step 1: Determine Entity Type

**Is this entity GLOBAL (shared across all clinics)?**
- Examples: `staff_users`, Auth tokens
- ✅ NO `clinicId` column
- ✅ Email/username globally unique
- ✅ Repository methods have NO `clinicId` parameter
- → Use **Global Entity Pattern** (see `staff_users` module)

**Is this entity CLINIC-OWNED (belongs to one clinic)?**
- Examples: Patients, Doctors, Schedules, Services
- ✅ HAVE `clinicId` column — NOT NULL, FK to `clinics.id`
- ✅ Always filtered by `clinicId` in every query
- ✅ Repository methods ALWAYS accept `clinicId` parameter
- → Use **Clinic-Owned Entity Pattern** (see `patients`, `doctors` modules)

**Is this entity HYBRID (connects global and clinic entities)?**
- Examples: Appointments (connect patients to clinics)
- ✅ HAVE both `patientId` (clinic-owned) and `clinicId` (tenant)
- ✅ Dual-access pattern (patient vs staff)
- ✅ Context-aware repository methods
- → Use **Hybrid Entity Pattern** (see `appointments` module)

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
import { pgTable, uuid, varchar, timestamp, pgEnum, index, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clinics } from "../clinics/clinic.schema.js";
import { patients } from "../patients/patient.schema.js";
import { doctors } from "../doctors/doctor.schema.js";

// ─── Enums ────────────────────────────────────────────────────────────────────
// Always use pgEnum for fixed value sets — never varchar for status/type/role
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending", "confirmed", "cancelled", "completed", "no_show",
]);

// ─── Table ────────────────────────────────────────────────────────────────────
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ✅ Tenant isolation — always required, never nullable
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),

    // ✅ Clinic-owned patient — NOT a global staff_user
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),

    // ✅ Optional FK — nullable FKs use onDelete: "set null"
    doctorId: uuid("doctor_id")
      .references(() => doctors.id, { onDelete: "set null" }),

    title: varchar("title", { length: 200 }).notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").default(60).notNull(),
    status: appointmentStatusEnum("status").default("pending").notNull(),
    notes: text("notes"),

    // ✅ Soft-delete — never hard-delete business records
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    // ✅ Always include both timestamps with timezone
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // ── Foreign key indexes (required on every FK column) ──────────────────
    clinicIdx: index("appointments_clinic_idx").on(t.clinicId),
    patientIdx: index("appointments_patient_idx").on(t.patientId),
    doctorIdx: index("appointments_doctor_idx").on(t.doctorId),

    // ── Single-column indexes for common WHERE filters ─────────────────────
    scheduledAtIdx: index("appointments_scheduled_at_idx").on(t.scheduledAt),
    statusIdx: index("appointments_status_idx").on(t.status),

    // ── Composite indexes for common query patterns ────────────────────────
    // Staff dashboard: clinic appointments by time (partial — excludes deleted)
    clinicScheduledIdx: index("appointments_clinic_scheduled_idx")
      .on(t.clinicId, t.scheduledAt)
      .where(sql`${t.deletedAt} IS NULL`),

    // Staff filter by status
    clinicStatusIdx: index("appointments_clinic_status_idx")
      .on(t.clinicId, t.status)
      .where(sql`${t.deletedAt} IS NULL`),

    // Patient history view
    clinicPatientIdx: index("appointments_clinic_patient_idx")
      .on(t.clinicId, t.patientId)
      .where(sql`${t.deletedAt} IS NULL`),

    // Doctor schedule view — overlap detection
    doctorScheduledIdx: index("appointments_doctor_scheduled_idx")
      .on(t.doctorId, t.scheduledAt)
      .where(sql`${t.deletedAt} IS NULL AND ${t.status} NOT IN ('cancelled', 'no_show')`),

    // ── Unique constraints ─────────────────────────────────────────────────
    // Prevent double-booking: same doctor cannot have two appointments at same time
    doctorDoubleBookingUnique: unique("appointments_doctor_no_double_booking")
      .on(t.doctorId, t.scheduledAt, t.clinicId)
      .nullsNotDistinct(),

    // ── CHECK constraints ──────────────────────────────────────────────────
    durationCheck: check(
      "chk_appointment_duration",
      sql`${t.durationMinutes} > 0 AND ${t.durationMinutes} <= 480`
    ),
  })
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
```

---

### 🗂️ Index Strategy Reference

Every schema must follow this index decision tree:

#### 1. Foreign Key Indexes — ALWAYS required
Every FK column must have an index. PostgreSQL does not auto-index FKs.
```typescript
// ✅ Every FK gets an index
clinicIdx: index("table_clinic_idx").on(t.clinicId),
patientIdx: index("table_patient_idx").on(t.patientId),
doctorIdx: index("table_doctor_idx").on(t.doctorId),
```

#### 2. Search Indexes — for text search columns
Use `ilike` in queries? Add an index. For case-insensitive search, use a functional index.
```typescript
// Standard index — works with ilike('%term%') but only for prefix searches
nameIdx: index("table_name_idx").on(t.name),

// For full ilike('%term%') performance at scale, use pg_trgm extension:
// CREATE INDEX table_name_trgm_idx ON table USING gin(name gin_trgm_ops);
// Note: Drizzle doesn't support gin indexes natively — add via raw SQL migration.
```

#### 3. Composite Indexes — for multi-column WHERE clauses
Column order matters: put the most selective column first, then the sort column.
```typescript
// ✅ Covers: WHERE clinic_id = ? AND scheduled_at > ?
clinicScheduledIdx: index("table_clinic_scheduled_idx").on(t.clinicId, t.scheduledAt),

// ✅ Covers: WHERE clinic_id = ? AND status = ?
clinicStatusIdx: index("table_clinic_status_idx").on(t.clinicId, t.status),

// ✅ Covers: WHERE clinic_id = ? AND specialty = ?
clinicSpecialtyIdx: index("table_clinic_specialty_idx").on(t.clinicId, t.specialty),
```

#### 4. Partial Indexes — for soft-delete and filtered queries
Partial indexes are smaller and faster than full indexes when most rows are excluded.
```typescript
// ✅ Only index active (non-deleted) rows — much smaller index
clinicActiveIdx: index("table_clinic_active_idx")
  .on(t.clinicId, t.isActive)
  .where(sql`${t.deletedAt} IS NULL`),

// ✅ Marketplace query: published + active + not deleted
marketplaceIdx: index("table_marketplace_idx")
  .on(t.isPublished, t.isActive)
  .where(sql`${t.deletedAt} IS NULL`),
```

#### 5. Unique Constraints — duplication prevention rules

**Standard unique (non-nullable columns):**
```typescript
// Simple unique — email must be globally unique
emailUnique: unique("table_email_unique").on(t.email),

// Composite unique — name must be unique per clinic
nameClinicUnique: unique("table_name_clinic_unique").on(t.name, t.clinicId),
```

**Partial unique (nullable columns) — CRITICAL:**
PostgreSQL treats `NULL != NULL` in unique constraints.
`unique(email, clinicId)` allows unlimited `(NULL, clinicId)` rows — the constraint is silently bypassed.
Always use `.nullsNotDistinct()` or document the NULL behavior explicitly.

```typescript
// ✅ Email unique per clinic — only enforced when email IS NOT NULL
emailClinicUnique: unique("patients_email_clinic_unique")
  .on(t.email, t.clinicId)
  .nullsNotDistinct(),

// ✅ Slug unique — freed when clinic is soft-deleted
slugActiveUnique: unique("clinics_slug_active_unique")
  .on(t.slug)
  .nullsNotDistinct(),
```

**Global vs clinic-scoped NULL-safe unique (RBAC pattern):**
```typescript
// ✅ Global assignments (clinicId IS NULL): unique on (staffUserId, roleId)
globalAssignmentUnique: unique("staff_user_roles_global_unique")
  .on(t.staffUserId, t.roleId)
  .nullsNotDistinct(),

// ✅ Clinic assignments (clinicId IS NOT NULL): unique on (staffUserId, roleId, clinicId)
clinicAssignmentUnique: unique("staff_user_roles_clinic_unique")
  .on(t.staffUserId, t.roleId, t.clinicId)
  .nullsNotDistinct(),
```

#### 6. CHECK Constraints — data integrity at DB level
```typescript
// ✅ Numeric bounds
durationCheck: check("chk_duration", sql`${t.durationMinutes} > 0 AND ${t.durationMinutes} <= 480`),
feeCheck: check("chk_fee", sql`${t.consultationFee} IS NULL OR ${t.consultationFee} >= 0`),
experienceCheck: check("chk_experience", sql`${t.experienceYears} IS NULL OR (${t.experienceYears} >= 0 AND ${t.experienceYears} <= 70)`),

// ✅ Time ordering (schedules)
timeOrderCheck: check("chk_time_order", sql`${t.endTime} > ${t.startTime}`),
```

---

### ✅ Schema Checklist

**Structure:**
- [ ] Use `uuid("id").primaryKey().defaultRandom()` for ID
- [ ] Add `createdAt` and `updatedAt` with `{ withTimezone: true }` and `.notNull()`
- [ ] Add `deletedAt` timestamp for soft-delete (null = active)
- [ ] Use `pgEnum` for ALL fixed value sets — never `varchar` for status/type/role
- [ ] Import tables from module schemas, NOT from `db/schema.ts`
- [ ] Register in `src/db/schema.ts`

**Foreign Keys:**
- [ ] Required FKs: `.notNull().references(() => table.id, { onDelete: "restrict" })`
- [ ] Optional FKs: `.references(() => table.id, { onDelete: "set null" })`
- [ ] Cascade FKs (child data): `.references(() => table.id, { onDelete: "cascade" })`
- [ ] Auth tokens: use `onDelete: "cascade"` NOT `"restrict"` (blocks user deletion)
- [ ] Every FK column has a corresponding index

**Indexes:**
- [ ] Index on every FK column
- [ ] Index on every column used in WHERE clauses (status, isActive, scheduledAt)
- [ ] Composite index for every multi-column query pattern
- [ ] Partial index (`.where(sql\`deleted_at IS NULL\`\`)) for soft-deleted tables
- [ ] Search columns (name, email) have an index

**Unique Constraints:**
- [ ] Unique on email/slug for global entities
- [ ] Composite unique `(field, clinicId)` for clinic-scoped uniqueness
- [ ] Use `.nullsNotDistinct()` on any unique that includes a nullable column
- [ ] For NULL-able FK uniques (RBAC): use two separate uniques (global + clinic-scoped)

**CHECK Constraints:**
- [ ] Numeric fields with bounds have `CHECK` constraints
- [ ] Time-ordered fields (startTime/endTime) have ordering `CHECK`
- [ ] Duration/fee/count fields have minimum value `CHECK`

**Duplication Prevention:**
- [ ] Identify all "one per X" rules and add unique constraints
- [ ] Double-booking: unique on `(doctorId, scheduledAt, clinicId)` for appointments
- [ ] One schedule per day: unique on `(doctorId, dayOfWeek)`
- [ ] One staff account per doctor per clinic: unique on `(staffUserId, clinicId)`

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
- [ ] **Always filter `deletedAt IS NULL`** in list and findById queries
- [ ] Soft-delete sets `deletedAt = new Date()` — never use `db.delete()` for business records
- [ ] Search queries use `ilike` with `%term%` and have a corresponding index on the column
- [ ] Verify cross-tenant integrity before insert: `patient.clinicId === appointment.clinicId`

### 🗑️ Soft-Delete Pattern in Repository

```typescript
import { isNull, sql } from "drizzle-orm";

// ✅ Always exclude soft-deleted rows in list queries
const conditions: SQL[] = [
  eq(table.clinicId, clinicId),
  isNull(table.deletedAt),   // exclude soft-deleted
];

// ✅ Soft-delete — never hard-delete business records
async softDelete(id: string, clinicId: string): Promise<boolean> {
  const result = await db
    .update(table)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(table.id, id), eq(table.clinicId, clinicId), isNull(table.deletedAt)))
    .returning();
  return result.length > 0;
},

// ✅ Search with ilike — requires index on the searched column
if (search) {
  conditions.push(ilike(table.name, `%${search}%`));
}
```

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
- [ ] Check existence before update/delete (use `isNull(deletedAt)` in lookup)
- [ ] **Check for duplicates before create** — query for existing record with same unique fields
- [ ] **Verify cross-tenant integrity** — confirm `patient.clinicId === input.clinicId` before insert
- [ ] **Verify referenced entities belong to same clinic** — doctor, patient, schedule must all share `clinicId`
- [ ] Use `!== undefined` for falsy value checks
- [ ] Log all important actions (create, update, delete)
- [ ] Use `logger.info()` for normal ops, `logger.warn()` for deletes
- [ ] For hybrid entities: branch logic based on `context.userType`

### 🔒 Duplication & Cross-Tenant Guard Pattern

```typescript
// ✅ Check for duplicate before create (e.g. patient email per clinic)
const existing = await patientRepository.findByEmail(input.email, context.clinicId);
if (existing) throw new ConflictError(t("patients.emailExists"));

// ✅ Cross-tenant integrity check — doctor must belong to same clinic
if (input.doctorId) {
  const doctor = await doctorRepository.findById(input.doctorId, context.clinicId);
  if (!doctor) throw new BadRequestError(t("appointments.doctorNotInClinic"));
}

// ✅ Double-booking check — before inserting appointment
if (input.doctorId) {
  const conflict = await appointmentRepository.findConflict(
    input.doctorId,
    input.scheduledAt,
    context.clinicId
  );
  if (conflict) throw new ConflictError(t("appointments.doctorNotAvailable"));
}
```

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

1. **Context-Aware Access** — Different logic for patient vs staff
2. **Dual-Access Pattern** — Separate repository methods for each access pattern
3. **Translation Keys** — ALL user-facing messages use i18n
4. **Permission Checks** — ALWAYS check permissions in service layer
5. **Structured Logging** — Log all important actions with context
6. **Type Safety** — Use TypeScript types throughout
7. **Validation** — Validate at the edge (routes), enforce in service
8. **Soft-Delete** — Never hard-delete business records; use `deletedAt` timestamp
9. **Index Everything** — Every FK, every WHERE column, every search column
10. **Prevent Duplication** — Unique constraints at DB level + duplicate checks in service
11. **Tenant Isolation** — Every clinic-owned query starts with `clinicId` filter; verify cross-entity clinic ownership before insert
12. **NULL-Safe Uniques** — Use `.nullsNotDistinct()` on any unique constraint that includes a nullable column

---

## ⚠️ Common Mistakes to Avoid

| Mistake | Correct Approach |
|---|---|
| `varchar` for status/type/role | Use `pgEnum` |
| Missing index on FK column | Index every FK |
| `unique(field, clinicId)` with nullable field | Add `.nullsNotDistinct()` |
| `unique(staffUserId, roleId, clinicId)` with nullable clinicId | Two separate uniques: global + clinic-scoped |
| `onDelete: "restrict"` on auth tokens | Use `onDelete: "cascade"` |
| Hard-deleting business records | Set `deletedAt = new Date()` |
| Not filtering `deletedAt IS NULL` in queries | Always add `isNull(table.deletedAt)` |
| Inserting appointment without checking doctor's clinic | Verify `doctor.clinicId === appointment.clinicId` |
| Free-text search without index | Add index on searched column |
| No CHECK on numeric bounds | Add `CHECK` for fees, durations, counts |
| Duplicate global role names | Separate unique for `(name)` where `clinicId IS NULL` |

---

## 📚 Reference Modules

- **Global Entity:** `api/src/modules/staff-users/` — StaffUsers (no clinicId, full RBAC)
- **Clinic-Owned Entity:** `api/src/modules/patients/` — Patients (clinicId required, no RBAC)
- **Clinic-Owned Entity:** `api/src/modules/doctors/` — Doctors (clinicId required, specialty enum)
- **Child Entity:** `api/src/modules/doctors/doctor-schedule.schema.ts` — Schedules (cascades from doctor)
- **Hybrid Entity:** `api/src/modules/appointments/` — Appointments (dual access + audit history)
- **RBAC:** `api/src/modules/rbac/` — Roles, Permissions, StaffUserRoles

---

**Date:** 2026-04-19
**Based on:** appointments, doctors, patients, clinics, staff-users, rbac modules
**Architecture:** Marketplace + Multi-Tenant + Hardened Production Schema
