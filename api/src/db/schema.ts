/**
 * Central schema barrel — re-exports every module schema.
 * Drizzle Kit reads this file via drizzle.config.ts.
 * Do NOT put table definitions here — they live in each module's *.schema.ts file.
 */

export * from "../modules/users/user.schema.js";
export * from "../modules/clinics/clinic.schema.js";
export * from "../modules/appointments/appointment.schema.js";
export * from "../modules/auth/auth.schema.js";
export * from "../modules/rbac/rbac.schema.js";
