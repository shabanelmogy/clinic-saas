# 🔧 Implementation Examples - Marketplace Architecture

This document provides complete, copy-paste ready code examples for the refactored architecture.

---

## 📁 File: `api/src/modules/users/user.schema.ts` (UPDATED - Global Users)

```typescript
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

/**
 * GLOBAL Users table (Patients)
 * 
 * ✅ NO clinic_id - users are global entities
 * ✅ Can interact with ANY clinic
 * ✅ Email is globally unique
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // ✅ NO clinic_id - users are GLOBAL
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // ✅ Email is globally unique (not per clinic)
    emailUnique: unique("users_email_unique").on(t.email),
    emailIdx: index("users_email_idx").on(t.email),
    isActiveIdx: index("users_is_active_idx").on(t.isActive),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

---

## 📁 File: `api/src/modules/clinics/clinic.schema.ts` (NEW)

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Clinics table - Tenant entities
 */
export const clinics = pgTable(
  "clinics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(), // URL-friendly identifier
    description: text("description"),
    address: text("address"),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 255 }),
    logo: varchar("logo", { length: 500 }), // URL to logo image
    isActive: boolean("is_active").default(true).notNull(),
    isPublished: boolean("is_published").default(false).notNull(), // Marketplace visibility
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugUnique: unique("clinics_slug_unique").on(t.slug),
    isPublishedIdx: index("clinics_is_published_idx").on(t.isPublished),
    isActiveIdx: index("clinics_is_active_idx").on(t.isActive),
  })
);

/**
 * Clinic Staff table - Employees (doctors, admins, receptionists)
 * Replaces the old "users" table for clinic employees
 */
export const clinicStaff = pgTable(
  "clinic_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).notNull(), // 'admin', 'doctor', 'receptionist'
    specialization: varchar("specialization", { length: 100 }), // For doctors
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Email unique per clinic
    emailClinicUnique: unique("clinic_staff_email_clinic_unique").on(t.email, t.clinicId),
    clinicIdx: index("clinic_staff_clinic_idx").on(t.clinicId),
    roleIdx: index("clinic_staff_role_idx").on(t.role),
    isActiveIdx: index("clinic_staff_is_active_idx").on(t.isActive),
  })
);

export type Clinic = typeof clinics.$inferSelect;
export type NewClinic = typeof clinics.$inferInsert;
export type ClinicStaff = typeof clinicStaff.$inferSelect;
export type NewClinicStaff = typeof clinicStaff.$inferInsert;
```

---

## 📁 File: `api/src/modules/appointments/appointment.schema.ts` (UPDATED)

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { users } from "../users/user.schema.js";
import { clinics, clinicStaff } from "../clinics/clinic.schema.js";

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

/**
 * Appointments table - Hybrid access
 * 
 * ✅ patientId references GLOBAL users
 * ✅ clinicId for tenant isolation
 * ✅ doctorId references clinic staff (optional)
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }), // ✅ Global user
    doctorId: uuid("doctor_id")
      .references(() => clinicStaff.id, { onDelete: "restrict" }), // Optional
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").default(60).notNull(),
    status: appointmentStatusEnum("status").default("pending").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clinicIdx: index("appointments_clinic_idx").on(t.clinicId),
    patientIdx: index("appointments_patient_idx").on(t.patientId), // ✅ For patient queries
    doctorIdx: index("appointments_doctor_idx").on(t.doctorId),
    scheduledAtIdx: index("appointments_scheduled_at_idx").on(t.scheduledAt),
    statusIdx: index("appointments_status_idx").on(t.status),
    // Composite indexes
    clinicScheduledIdx: index("appointments_clinic_scheduled_idx").on(t.clinicId, t.scheduledAt),
    patientScheduledIdx: index("appointments_patient_scheduled_idx").on(t.patientId, t.scheduledAt),
  })
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
```

---

## 📁 File: `api/src/modules/appointments/appointment.repository.ts` (UPDATED)

```typescript
import { eq, and, count, SQL } from "drizzle-orm";
import { db } from "../../db/index.js";
import { appointments, type Appointment, type NewAppointment } from "./appointment.schema.js";

export const appointmentRepository = {
  /**
   * Find appointments for a PATIENT (across all clinics)
   * ✅ NO clinic_id filter - patient sees all their appointments
   */
  async findAllForPatient(
    patientId: string,
    query: { page: number; limit: number; status?: string }
  ): Promise<{ data: Appointment[]; total: number }> {
    const { page, limit, status } = query;
    const offset = (page - 1) * limit;

    // ✅ CRITICAL: Only filter by patientId, NOT clinicId
    const conditions: SQL[] = [eq(appointments.patientId, patientId)];
    if (status) conditions.push(eq(appointments.status, status));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(appointments)
        .where(where)
        .orderBy(appointments.scheduledAt)
        .limit(limit)
        .offset(offset),
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
    query: { page: number; limit: number; status?: string; patientId?: string }
  ): Promise<{ data: Appointment[]; total: number }> {
    const { page, limit, status, patientId } = query;
    const offset = (page - 1) * limit;

    // ✅ CRITICAL: Always start with clinicId filter
    const conditions: SQL[] = [eq(appointments.clinicId, clinicId)];
    if (status) conditions.push(eq(appointments.status, status));
    if (patientId) conditions.push(eq(appointments.patientId, patientId));

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(appointments)
        .where(where)
        .orderBy(appointments.scheduledAt)
        .limit(limit)
        .offset(offset),
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
      // ✅ Patient: Check they own the appointment (no clinic filter)
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

  /**
   * Update appointment - context-aware
   */
  async update(
    id: string,
    data: Partial<NewAppointment>,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<Appointment | undefined> {
    let where: SQL;

    if (context.userType === "patient") {
      where = and(
        eq(appointments.id, id),
        eq(appointments.patientId, context.userId)
      );
    } else {
      where = and(
        eq(appointments.id, id),
        eq(appointments.clinicId, context.clinicId!)
      );
    }

    const [appointment] = await db
      .update(appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(where)
      .returning();

    return appointment;
  },

  /**
   * Delete appointment - context-aware
   */
  async delete(
    id: string,
    context: { userType: "patient" | "staff"; userId: string; clinicId?: string }
  ): Promise<boolean> {
    let where: SQL;

    if (context.userType === "patient") {
      where = and(
        eq(appointments.id, id),
        eq(appointments.patientId, context.userId)
      );
    } else {
      where = and(
        eq(appointments.id, id),
        eq(appointments.clinicId, context.clinicId!)
      );
    }

    const result = await db.delete(appointments).where(where).returning();
    return result.length > 0;
  },

  /**
   * Count appointments by patient (for clinic staff)
   */
  async countByPatientId(patientId: string, clinicId: string): Promise<number> {
    const [{ value }] = await db
      .select({ value: count() })
      .from(appointments)
      .where(and(eq(appointments.patientId, patientId), eq(appointments.clinicId, clinicId)));
    return Number(value);
  },
};
```

---

## 📁 File: `api/src/types/express.d.ts` (UPDATED - Add userType)

```typescript
import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        userType: "patient" | "staff"; // ✅ NEW: Identifies user type
        clinicId?: string; // Only present for staff
        permissions: string[];
        roles?: string[]; // Only present for staff
      };
      t: (key: string, params?: Record<string, string | number>) => string;
    }
  }
}
```

---

## 📁 File: `api/src/modules/public/clinics/clinic.service.ts` (NEW)

```typescript
import { clinicRepository } from "./clinic.repository.js";
import { NotFoundError } from "../../../utils/errors.js";
import { logger } from "../../../utils/logger.js";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const publicClinicService = {
  /**
   * List all published clinics (marketplace)
   * ✅ NO authentication required
   * ✅ Only show isPublished = true
   */
  async listPublicClinics(
    query: { page: number; limit: number; search?: string },
    t: TranslateFn
  ) {
    const { data, total } = await clinicRepository.findAllPublished(query);

    logger.info({
      msg: "Public clinics listed",
      count: data.length,
      total,
    });

    return { data, total, page: query.page, limit: query.limit };
  },

  /**
   * Get clinic by slug (public)
   */
  async getPublicClinicBySlug(slug: string, t: TranslateFn) {
    const clinic = await clinicRepository.findBySlug(slug);

    if (!clinic || !clinic.isPublished) {
      throw new NotFoundError(t("clinics.notFound"));
    }

    logger.info({
      msg: "Public clinic retrieved",
      clinicId: clinic.id,
      slug,
    });

    return clinic;
  },
};
```

---

## 📁 File: `api/src/modules/public/clinics/clinic.repository.ts` (NEW)

```typescript
import { eq, and, count, SQL, ilike } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { clinics, type Clinic } from "../../clinics/clinic.schema.js";

export const clinicRepository = {
  /**
   * Find all published clinics (for marketplace)
   */
  async findAllPublished(
    query: { page: number; limit: number; search?: string }
  ): Promise<{ data: Clinic[]; total: number }> {
    const { page, limit, search } = query;
    const offset = (page - 1) * limit;

    // ✅ Only show published and active clinics
    const conditions: SQL[] = [
      eq(clinics.isPublished, true),
      eq(clinics.isActive, true),
    ];

    if (search) {
      conditions.push(ilike(clinics.name, `%${search}%`));
    }

    const where = and(...conditions);

    const [data, [{ value: total }]] = await Promise.all([
      db.select().from(clinics).where(where).limit(limit).offset(offset),
      db.select({ value: count() }).from(clinics).where(where),
    ]);

    return { data, total: Number(total) };
  },

  /**
   * Find clinic by slug (public)
   */
  async findBySlug(slug: string): Promise<Clinic | undefined> {
    const [clinic] = await db
      .select()
      .from(clinics)
      .where(eq(clinics.slug, slug));
    return clinic;
  },
};
```

---

## 📁 File: `api/src/server.ts` (UPDATED - Register routes)

```typescript
import express from "express";
import { i18nMiddleware } from "./middlewares/i18n.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

// Public routes (no auth)
import publicClinicRoutes from "./modules/public/clinics/clinic.routes.js";
import publicDoctorRoutes from "./modules/public/doctors/doctor.routes.js";

// Private routes (auth required)
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import appointmentRoutes from "./modules/appointments/appointment.routes.js";

const app = express();

// Middleware
app.use(express.json());
app.use(i18nMiddleware);

// ✅ PUBLIC ROUTES (no authentication)
app.use("/api/public/clinics", publicClinicRoutes);
app.use("/api/public/doctors", publicDoctorRoutes);

// ✅ PRIVATE ROUTES (authentication required)
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/appointments", appointmentRoutes);

// Error handling
app.use(errorMiddleware);

export default app;
```

---

## 🔑 Key Differences Summary

### Patient Queries (Cross-Clinic)
```typescript
// ✅ CORRECT - No clinic filter
const appointments = await db
  .select()
  .from(appointments)
  .where(eq(appointments.patientId, patientId)); // Only filter by patient

// ❌ WRONG - Don't filter by clinic
const appointments = await db
  .select()
  .from(appointments)
  .where(and(
    eq(appointments.patientId, patientId),
    eq(appointments.clinicId, clinicId) // ❌ NO! Patient sees all clinics
  ));
```

### Staff Queries (Clinic-Scoped)
```typescript
// ✅ CORRECT - Always filter by clinic
const appointments = await db
  .select()
  .from(appointments)
  .where(and(
    eq(appointments.clinicId, clinicId), // ✅ ALWAYS include this
    eq(appointments.status, "pending")
  ));

// ❌ WRONG - Missing clinic filter
const appointments = await db
  .select()
  .from(appointments)
  .where(eq(appointments.status, "pending")); // ❌ NO! Staff must be scoped
```

### Public Queries (Marketplace)
```typescript
// ✅ CORRECT - Only published clinics
const clinics = await db
  .select()
  .from(clinics)
  .where(and(
    eq(clinics.isPublished, true),
    eq(clinics.isActive, true)
  ));

// ❌ WRONG - Showing unpublished clinics
const clinics = await db
  .select()
  .from(clinics)
  .where(eq(clinics.isActive, true)); // ❌ NO! Must check isPublished
```

---

**Status:** ✅ Ready to implement
