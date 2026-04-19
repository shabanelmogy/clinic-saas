import "../src/config/env.js";
import bcrypt from "bcrypt";
import { sql, eq, and, isNull } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { closeDb } from "../src/db/index.js";
import { seedRBAC } from "../src/modules/rbac/seed-rbac.js";

import { staffUsers } from "../src/modules/staff-users/staff-user.schema.js";
import { clinics } from "../src/modules/clinics/clinic.schema.js";
import { doctors } from "../src/modules/doctors/doctor.schema.js";
import { doctorSchedules } from "../src/modules/doctor-schedules/doctor-schedule.schema.js";
import { patients } from "../src/modules/patients/patient.schema.js";
import { slotTimes } from "../src/modules/slot-times/slot-time.schema.js";
import { appointments, appointmentHistory } from "../src/modules/appointments/appointment.schema.js";
import { patientRequests } from "../src/modules/patient-requests/patient-request.schema.js";
import { doctorRequests } from "../src/modules/doctor-requests/doctor-request.schema.js";
import { roles, staffUserRoles } from "../src/modules/rbac/rbac.schema.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hash = (pw: string) => bcrypt.hash(pw, 12);

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function setTime(date: Date, hour: number, minute = 0): Date {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Insert or fetch — inserts the row, and if it already exists fetches it.
 * Ensures variables are always populated on re-runs.
 */
async function upsertStaffUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  phone: string;
}) {
  const [existing] = await db
    .select()
    .from(staffUsers)
    .where(and(eq(staffUsers.email, data.email), isNull(staffUsers.deletedAt)));
  if (existing) return existing;
  const [created] = await db.insert(staffUsers).values({ ...data, isActive: true }).returning();
  return created;
}

async function upsertClinic(data: {
  name: string;
  slug: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  isActive: boolean;
  isPublished: boolean;
}) {
  const [existing] = await db
    .select()
    .from(clinics)
    .where(eq(clinics.slug, data.slug));
  if (existing) return existing;
  const [created] = await db.insert(clinics).values(data).returning();
  return created;
}

async function getGlobalRole(name: string) {
  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.name, name), isNull(roles.clinicId)));
  return role;
}

async function assignRole(staffUserId: string, roleId: string, clinicId: string | null) {
  await db
    .insert(staffUserRoles)
    .values({ staffUserId, roleId, clinicId })
    .onConflictDoNothing();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting full dev seed...\n");

  console.log("⏳ Connecting to database...");
  await db.execute(sql`SELECT 1`);
  console.log("✅ Database connected\n");

  // ── 1. RBAC ───────────────────────────────────────────────────────────────
  await seedRBAC();

  // ── 2. Staff Users ────────────────────────────────────────────────────────
  console.log("👤 Seeding staff users...");

  const superAdmin  = await upsertStaffUser({ name: "Super Admin",      email: "super@clinicsaas.com",        passwordHash: await hash("SuperAdmin1"),  phone: "+1-555-0001" });
  const clinicAdmin1 = await upsertStaffUser({ name: "Alice Johnson",   email: "alice@cityhealth.com",         passwordHash: await hash("ClinicAdmin1"), phone: "+1-555-0002" });
  const clinicAdmin2 = await upsertStaffUser({ name: "Bob Martinez",    email: "bob@sunriseclinic.com",        passwordHash: await hash("ClinicAdmin1"), phone: "+1-555-0003" });
  const drSmith      = await upsertStaffUser({ name: "Dr. Sarah Smith", email: "sarah.smith@cityhealth.com",   passwordHash: await hash("Doctor1234!"),  phone: "+1-555-0010" });
  const drLee        = await upsertStaffUser({ name: "Dr. James Lee",   email: "james.lee@cityhealth.com",     passwordHash: await hash("Doctor1234!"),  phone: "+1-555-0011" });
  const receptionist = await upsertStaffUser({ name: "Emma Wilson",     email: "emma@cityhealth.com",          passwordHash: await hash("Reception1!"),  phone: "+1-555-0020" });

  console.log("  ✅ 6 staff users ready\n");

  // ── 3. Clinics ────────────────────────────────────────────────────────────
  console.log("🏥 Seeding clinics...");

  const clinic1 = await upsertClinic({
    name: "City Health Clinic",
    slug: "city-health-clinic",
    description: "A full-service primary care clinic in downtown.",
    address: "123 Main Street, New York, NY 10001",
    phone: "+1-555-1000",
    email: "info@cityhealth.com",
    website: "https://cityhealth.com",
    isActive: true,
    isPublished: true,
  });

  const clinic2 = await upsertClinic({
    name: "Sunrise Medical Center",
    slug: "sunrise-medical-center",
    description: "Specialized cardiology and internal medicine.",
    address: "456 Park Avenue, Los Angeles, CA 90001",
    phone: "+1-555-2000",
    email: "info@sunriseclinic.com",
    website: "https://sunriseclinic.com",
    isActive: true,
    isPublished: true,
  });

  const clinic3 = await upsertClinic({
    name: "Green Valley Pediatrics",
    slug: "green-valley-pediatrics",
    description: "Dedicated pediatric care for children of all ages.",
    address: "789 Oak Lane, Chicago, IL 60601",
    phone: "+1-555-3000",
    email: "info@greenvalley.com",
    isActive: true,
    isPublished: false,
  });

  console.log("  ✅ 3 clinics ready\n");

  // ── 4. Assign Roles ───────────────────────────────────────────────────────
  console.log("🔐 Assigning roles...");

  const superAdminRole   = await getGlobalRole("Super Admin");
  const clinicAdminRole  = await getGlobalRole("Clinic Admin");
  const doctorRole       = await getGlobalRole("Doctor");
  const receptionRole    = await getGlobalRole("Receptionist");

  if (!superAdminRole || !clinicAdminRole || !doctorRole || !receptionRole) {
    throw new Error("Global roles not found — did seedRBAC() run successfully?");
  }

  // Super Admin — global (no clinic scope)
  await assignRole(superAdmin.id, superAdminRole.id, null);

  // Clinic Admins — scoped to their clinic
  await assignRole(clinicAdmin1.id, clinicAdminRole.id, clinic1.id);
  await assignRole(clinicAdmin2.id, clinicAdminRole.id, clinic2.id);

  // Doctors — scoped to City Health
  await assignRole(drSmith.id, doctorRole.id, clinic1.id);
  await assignRole(drLee.id,   doctorRole.id, clinic1.id);

  // Receptionist — scoped to City Health
  await assignRole(receptionist.id, receptionRole.id, clinic1.id);

  console.log("  ✅ Roles assigned\n");
  console.log("  📋 Role summary:");
  console.log(`     ${superAdmin.email.padEnd(38)} → Super Admin (global)`);
  console.log(`     ${clinicAdmin1.email.padEnd(38)} → Clinic Admin @ City Health`);
  console.log(`     ${clinicAdmin2.email.padEnd(38)} → Clinic Admin @ Sunrise`);
  console.log(`     ${drSmith.email.padEnd(38)} → Doctor @ City Health`);
  console.log(`     ${drLee.email.padEnd(38)} → Doctor @ City Health`);
  console.log(`     ${receptionist.email.padEnd(38)} → Receptionist @ City Health\n`);

  // ── 5. Doctors ────────────────────────────────────────────────────────────
  console.log("👨‍⚕️ Seeding doctors...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper: find or create doctor by email+clinic
  async function upsertDoctor(data: typeof doctors.$inferInsert) {
    const [existing] = await db
      .select()
      .from(doctors)
      .where(and(eq(doctors.email, data.email!), eq(doctors.clinicId, data.clinicId), isNull(doctors.deletedAt)));
    if (existing) return existing;
    const [created] = await db.insert(doctors).values(data).returning();
    return created;
  }

  const doctor1 = await upsertDoctor({
    clinicId: clinic1.id,
    staffUserId: drSmith.id,
    name: "Dr. Sarah Smith",
    specialty: "cardiology",
    bio: "Board-certified cardiologist with 12 years of experience.",
    phone: "+1-555-0010",
    email: "sarah.smith@cityhealth.com",
    experienceYears: 12,
    consultationFee: 15000,
    isActive: true,
    isPublished: true,
  });

  const doctor2 = await upsertDoctor({
    clinicId: clinic1.id,
    staffUserId: drLee.id,
    name: "Dr. James Lee",
    specialty: "general_practice",
    bio: "Family medicine physician focused on preventive care.",
    phone: "+1-555-0011",
    email: "james.lee@cityhealth.com",
    experienceYears: 8,
    consultationFee: 10000,
    isActive: true,
    isPublished: true,
  });

  const doctor3 = await upsertDoctor({
    clinicId: clinic2.id,
    name: "Dr. Maria Garcia",
    specialty: "neurology",
    bio: "Neurologist specializing in headache disorders and epilepsy.",
    phone: "+1-555-0012",
    email: "maria.garcia@sunriseclinic.com",
    experienceYears: 15,
    consultationFee: 20000,
    isActive: true,
    isPublished: true,
  });

  const doctor4 = await upsertDoctor({
    clinicId: clinic1.id,
    name: "Dr. Kevin Park",
    specialty: "dermatology",
    bio: "Dermatologist with expertise in skin cancer screening.",
    phone: "+1-555-0013",
    email: "kevin.park@cityhealth.com",
    experienceYears: 6,
    consultationFee: 12000,
    isActive: true,
    isPublished: false,
  });

  console.log("  ✅ 4 doctors ready\n");

  // ── 6. Doctor Schedules ───────────────────────────────────────────────────
  console.log("📅 Seeding doctor schedules...");

  for (const day of ["monday", "wednesday", "friday"] as const) {
    await db.insert(doctorSchedules).values({
      clinicId: clinic1.id, doctorId: doctor1.id,
      dayOfWeek: day, startTime: "09:00", endTime: "17:00",
      slotDurationMinutes: 30, maxAppointments: 1, isActive: true,
    }).onConflictDoNothing();
  }

  for (const day of ["tuesday", "thursday"] as const) {
    await db.insert(doctorSchedules).values({
      clinicId: clinic1.id, doctorId: doctor2.id,
      dayOfWeek: day, startTime: "08:00", endTime: "16:00",
      slotDurationMinutes: 20, maxAppointments: 1, isActive: true,
    }).onConflictDoNothing();
  }

  for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday"] as const) {
    await db.insert(doctorSchedules).values({
      clinicId: clinic2.id, doctorId: doctor3.id,
      dayOfWeek: day, startTime: "10:00", endTime: "18:00",
      slotDurationMinutes: 45, maxAppointments: 1, isActive: true,
    }).onConflictDoNothing();
  }

  console.log("  ✅ Doctor schedules ready\n");

  // ── 7. Slot Times ─────────────────────────────────────────────────────────
  console.log("🕐 Seeding slot times...");

  // Check if slots already exist to avoid duplicates on re-run
  const [existingSlot] = await db.select({ id: slotTimes.id }).from(slotTimes)
    .where(eq(slotTimes.clinicId, clinic1.id)).limit(1);

  if (existingSlot) {
    console.log("  ⏭️  Slots already exist — skipping\n");
  } else {
    const slotRows: typeof slotTimes.$inferInsert[] = [];

    for (let d = 1; d <= 10; d++) {
      const day = addDays(today, d);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;

      // Dr. Smith: 30-min slots 09:00–17:00
      for (let h = 9; h < 17; h++) {
        for (const m of [0, 30]) {
          const start = setTime(day, h, m);
          slotRows.push({ clinicId: clinic1.id, doctorId: doctor1.id, startTime: start, endTime: new Date(start.getTime() + 30 * 60_000), status: "available" });
        }
      }

      // Dr. Lee: 20-min slots 08:00–16:00
      for (let h = 8; h < 16; h++) {
        for (const m of [0, 20, 40]) {
          const start = setTime(day, h, m);
          slotRows.push({ clinicId: clinic1.id, doctorId: doctor2.id, startTime: start, endTime: new Date(start.getTime() + 20 * 60_000), status: "available" });
        }
      }

      // Dr. Garcia: 45-min slots 10:00–18:00
      for (let h = 10; h < 18; h++) {
        for (const m of [0, 45]) {
          if (h === 17 && m === 45) continue;
          const start = setTime(day, h, m);
          slotRows.push({ clinicId: clinic2.id, doctorId: doctor3.id, startTime: start, endTime: new Date(start.getTime() + 45 * 60_000), status: "available" });
        }
      }
    }

    for (let i = 0; i < slotRows.length; i += 50) {
      await db.insert(slotTimes).values(slotRows.slice(i, i + 50)).onConflictDoNothing();
    }
    console.log(`  ✅ ${slotRows.length} slot times created\n`);
  }

  // ── 8. Patients ───────────────────────────────────────────────────────────
  console.log("🧑‍🤝‍🧑 Seeding patients...");

  async function upsertPatient(data: typeof patients.$inferInsert) {
    const [existing] = await db.select().from(patients)
      .where(and(eq(patients.phone, data.phone!), eq(patients.clinicId, data.clinicId), isNull(patients.deletedAt)));
    if (existing) return existing;
    const [created] = await db.insert(patients).values(data).returning();
    return created;
  }

  const patient1 = await upsertPatient({ clinicId: clinic1.id, name: "John Doe",      phone: "+1-555-4001", email: "john.doe@email.com",    dateOfBirth: "1985-03-15", gender: "male",   bloodType: "O+", allergies: "Penicillin", isActive: true });
  const patient2 = await upsertPatient({ clinicId: clinic1.id, name: "Jane Smith",    phone: "+1-555-4002", email: "jane.smith@email.com",  dateOfBirth: "1990-07-22", gender: "female", bloodType: "A+", isActive: true });
  const patient3 = await upsertPatient({ clinicId: clinic1.id, name: "Robert Brown",  phone: "+1-555-4003", email: "robert.brown@email.com", dateOfBirth: "1978-11-08", gender: "male",   bloodType: "B-", medicalNotes: "Hypertension, Type 2 Diabetes", isActive: true });
  const patient4 = await upsertPatient({ clinicId: clinic2.id, name: "Emily Davis",   phone: "+1-555-4004", email: "emily.davis@email.com",  dateOfBirth: "1995-01-30", gender: "female", bloodType: "AB+", isActive: true });
  const patient5 = await upsertPatient({ clinicId: clinic1.id, name: "Michael Chen",  phone: "+1-555-4005", dateOfBirth: "1965-09-12",       gender: "male",   isActive: false });

  console.log("  ✅ 5 patients ready\n");

  // ── 9. Appointments ───────────────────────────────────────────────────────
  console.log("📋 Seeding appointments...");

  const [existingAppt] = await db.select({ id: appointments.id }).from(appointments)
    .where(eq(appointments.clinicId, clinic1.id)).limit(1);

  if (existingAppt) {
    console.log("  ⏭️  Appointments already exist — skipping\n");
  } else {
    const tomorrow = addDays(today, 1);
    const nextWeek = addDays(today, 7);
    const lastWeek = addDays(today, -7);

    const [appt1] = await db.insert(appointments).values({
      clinicId: clinic1.id, patientId: patient1.id, doctorId: doctor1.id,
      title: "Annual Cardiac Checkup", description: "Routine annual cardiac examination",
      scheduledAt: setTime(tomorrow, 10), durationMinutes: 30, status: "confirmed", version: 1,
    }).returning();

    const [appt2] = await db.insert(appointments).values({
      clinicId: clinic1.id, patientId: patient2.id, doctorId: doctor2.id,
      title: "General Consultation",
      scheduledAt: setTime(tomorrow, 14), durationMinutes: 20, status: "pending", version: 0,
    }).returning();

    const [appt3] = await db.insert(appointments).values({
      clinicId: clinic1.id, patientId: patient3.id, doctorId: doctor1.id,
      title: "Diabetes Follow-up", description: "3-month diabetes management review",
      scheduledAt: setTime(nextWeek, 9, 30), durationMinutes: 30, status: "pending", version: 0,
    }).returning();

    const [appt4] = await db.insert(appointments).values({
      clinicId: clinic1.id, patientId: patient1.id, doctorId: doctor2.id,
      title: "Initial Consultation",
      scheduledAt: setTime(lastWeek, 11), durationMinutes: 20, status: "completed", version: 2,
    }).returning();

    const [appt5] = await db.insert(appointments).values({
      clinicId: clinic1.id, patientId: patient2.id, doctorId: doctor1.id,
      title: "Follow-up Visit",
      scheduledAt: setTime(addDays(today, -3), 15), durationMinutes: 30,
      status: "cancelled", notes: "Patient requested cancellation", version: 1,
    }).returning();

    // Appointment history
    await db.insert(appointmentHistory).values([
      { appointmentId: appt1.id, clinicId: clinic1.id, previousStatus: null,        newStatus: "pending",   changedBy: receptionist.id,  changedAt: appt1.createdAt },
      { appointmentId: appt1.id, clinicId: clinic1.id, previousStatus: "pending",   newStatus: "confirmed", changedBy: clinicAdmin1.id,  changedAt: new Date(appt1.createdAt.getTime() + 3_600_000) },
      { appointmentId: appt4.id, clinicId: clinic1.id, previousStatus: null,        newStatus: "pending",   changedBy: receptionist.id,  changedAt: appt4.createdAt },
      { appointmentId: appt4.id, clinicId: clinic1.id, previousStatus: "pending",   newStatus: "confirmed", changedBy: clinicAdmin1.id,  changedAt: new Date(appt4.createdAt.getTime() + 1_800_000) },
      { appointmentId: appt4.id, clinicId: clinic1.id, previousStatus: "confirmed", newStatus: "completed", changedBy: drSmith.id,        changedAt: new Date(appt4.scheduledAt.getTime() + 1_800_000) },
      { appointmentId: appt5.id, clinicId: clinic1.id, previousStatus: null,        newStatus: "pending",   changedBy: receptionist.id,  changedAt: appt5.createdAt },
      { appointmentId: appt5.id, clinicId: clinic1.id, previousStatus: "pending",   newStatus: "cancelled", changedBy: null,              reason: "Patient requested cancellation", changedAt: new Date(appt5.createdAt.getTime() + 7_200_000) },
    ]);

    console.log("  ✅ 5 appointments + history created\n");
  }

  // ── 10. Patient Requests ──────────────────────────────────────────────────
  console.log("📨 Seeding patient requests...");

  const [existingPR] = await db.select({ id: patientRequests.id }).from(patientRequests).limit(1);
  if (existingPR) {
    console.log("  ⏭️  Patient requests already exist — skipping\n");
  } else {
    await db.insert(patientRequests).values([
      { clinicId: clinic1.id, name: "Sophia Turner",   phone: "+1-555-5001", email: "sophia.turner@email.com", dateOfBirth: "1992-04-18", gender: "female", status: "pending",  autoBook: false },
      { clinicId: clinic1.id, name: "Liam Johnson",    phone: "+1-555-5002", email: "liam.j@email.com",        dateOfBirth: "1988-12-05", gender: "male",   status: "pending",  autoBook: false },
      { clinicId: null,       name: "Olivia Martinez", phone: "+1-555-5003", email: "olivia.m@email.com",                                 gender: "female", status: "pending",  autoBook: false },
      { clinicId: clinic2.id, name: "Noah Williams",   phone: "+1-555-5004", email: "noah.w@email.com",        dateOfBirth: "1975-08-20", gender: "male",   status: "approved", reviewedBy: clinicAdmin2.id, reviewedAt: new Date() },
      { clinicId: clinic1.id, name: "Ava Brown",       phone: "+1-555-5005", email: "ava.b@email.com",                                    gender: "female", status: "rejected", reviewedBy: clinicAdmin1.id, reviewedAt: new Date(), rejectionReason: "Duplicate registration." },
    ]);
    console.log("  ✅ 5 patient requests created\n");
  }

  // ── 11. Doctor Requests ───────────────────────────────────────────────────
  console.log("🩺 Seeding doctor requests...");

  const [existingDR] = await db.select({ id: doctorRequests.id }).from(doctorRequests).limit(1);
  if (existingDR) {
    console.log("  ⏭️  Doctor requests already exist — skipping\n");
  } else {
    await db.insert(doctorRequests).values([
      { type: "join",   clinicId: clinic1.id, name: "Dr. Priya Patel",    phone: "+1-555-6001", email: "priya.patel@email.com",    specialty: "gynecology",  experienceYears: 9,  status: "pending" },
      { type: "join",   clinicId: clinic2.id, name: "Dr. Carlos Rivera",  phone: "+1-555-6002", email: "carlos.rivera@email.com",  specialty: "cardiology",  experienceYears: 14, status: "pending" },
      { type: "create", clinicId: null,       name: "Dr. Aisha Okonkwo",  phone: "+1-555-6003", email: "aisha.okonkwo@email.com",  specialty: "pediatrics",  experienceYears: 7,  clinicName: "Little Stars Pediatric Clinic", clinicAddress: "321 Elm Street, Houston, TX 77001", status: "pending" },
      { type: "join",   clinicId: clinic1.id, name: "Dr. Thomas Wright",  phone: "+1-555-6004", email: "thomas.wright@email.com",  specialty: "orthopedics", experienceYears: 11, status: "approved", reviewedBy: superAdmin.id, reviewedAt: new Date() },
      { type: "join",   clinicId: clinic2.id, name: "Dr. Fake Name",      phone: "+1-555-6005", email: "fake.doctor@email.com",    specialty: "surgery",     experienceYears: 0,  status: "rejected", reviewedBy: superAdmin.id, reviewedAt: new Date(), rejectionReason: "Credentials could not be verified." },
    ]);
    console.log("  ✅ 5 doctor requests created\n");
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("✅ Dev seed completed!\n");
  console.log("🔑 LOGIN CREDENTIALS");
  console.log("───────────────────────────────────────────────────────────────");
  console.log("Role            Email                              Password");
  console.log("───────────────────────────────────────────────────────────────");
  console.log(`Super Admin     super@clinicsaas.com               SuperAdmin1`);
  console.log(`Clinic Admin    alice@cityhealth.com               ClinicAdmin1`);
  console.log(`Clinic Admin    bob@sunriseclinic.com              ClinicAdmin1`);
  console.log(`Doctor          sarah.smith@cityhealth.com         Doctor1234!`);
  console.log(`Doctor          james.lee@cityhealth.com           Doctor1234!`);
  console.log(`Receptionist    emma@cityhealth.com                Reception1!`);
  console.log("───────────────────────────────────────────────────────────────");
  console.log("💡 Login tip: POST /api/v1/auth/login");
  console.log('   { "email": "...", "password": "...", "clinicId": "<id>" }');
  console.log("   Omit clinicId for Super Admin (global token)");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    closeDb().then(() => process.exit(1));
  });
