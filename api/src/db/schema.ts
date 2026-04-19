/**
 * Central schema barrel — re-exports every module schema.
 * Drizzle Kit reads this file via drizzle.config.ts.
 * Do NOT put table definitions here — they live in each module's *.schema.ts file.
 */

// ─── Global / System ──────────────────────────────────────────────────────────
export * from "../modules/staff-users/staff-user.schema.js";
export * from "../modules/auth/auth.schema.js";

// ─── RBAC (staff only) ────────────────────────────────────────────────────────
export * from "../modules/rbac/rbac.schema.js";

// ─── Tenant entities ──────────────────────────────────────────────────────────
export * from "../modules/clinics/clinic.schema.js";
export * from "../modules/patients/patient.schema.js";
export * from "../modules/doctors/doctor.schema.js";
export * from "../modules/doctor-schedules/doctor-schedule.schema.js";

// ─── Hybrid ───────────────────────────────────────────────────────────────────
export * from "../modules/appointments/appointment.schema.js";
export * from "../modules/slot-times/slot-time.schema.js";
