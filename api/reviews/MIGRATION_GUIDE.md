# 🔄 Migration Guide - Single-Tenant to Marketplace Architecture

**Date:** 2026-04-18  
**Type:** Breaking Change Migration  
**Estimated Time:** 4-6 hours

---

## 📋 Overview

This guide walks you through migrating from a single-tenant clinic SaaS to a marketplace + multi-tenant platform.

**What changes:**
- Users become GLOBAL (no `clinic_id`)
- Clinic employees move to `clinic_staff` table
- Appointments reference global users
- Dual access patterns (patient vs staff)

---

## ⚠️ Pre-Migration Checklist

- [ ] **Backup database** - Create full backup before starting
- [ ] **Test environment** - Run migration in staging first
- [ ] **Downtime window** - Schedule maintenance window (2-4 hours)
- [ ] **Team notification** - Inform all stakeholders
- [ ] **Rollback plan** - Prepare rollback scripts

---

## 🗄️ Phase 1: Database Migration

### Step 1: Create New Tables

```sql
-- Create clinics table
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  logo VARCHAR(500),
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_published BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX clinics_slug_idx ON clinics(slug);
CREATE INDEX clinics_is_published_idx ON clinics(is_published);
CREATE INDEX clinics_is_active_idx ON clinics(is_active);

-- Create clinic_staff table (replaces old users for employees)
CREATE TABLE clinic_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  specialization VARCHAR(100),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(email, clinic_id)
);

CREATE INDEX clinic_staff_clinic_idx ON clinic_staff(clinic_id);
CREATE INDEX clinic_staff_role_idx ON clinic_staff(role);
CREATE INDEX clinic_staff_is_active_idx ON clinic_staff(is_active);
```

---

### Step 2: Migrate Existing Data

```sql
-- Step 2.1: Extract unique clinics from existing users
-- (Assuming clinic_id exists in current users table)
INSERT INTO clinics (id, name, slug, is_active, is_published, created_at, updated_at)
SELECT DISTINCT
  clinic_id as id,
  'Clinic ' || clinic_id as name, -- Temporary name, update later
  'clinic-' || clinic_id as slug, -- Temporary slug, update later
  true as is_active,
  true as is_published, -- Make all existing clinics published
  NOW() as created_at,
  NOW() as updated_at
FROM users
WHERE clinic_id IS NOT NULL;

-- Step 2.2: Migrate existing users to clinic_staff
INSERT INTO clinic_staff (
  id,
  clinic_id,
  name,
  email,
  password_hash,
  role,
  is_active,
  created_at,
  updated_at
)
SELECT
  id,
  clinic_id,
  name,
  email,
  password_hash,
  'admin' as role, -- Default role, update later based on your logic
  is_active,
  created_at,
  updated_at
FROM users
WHERE clinic_id IS NOT NULL;

-- Step 2.3: Create backup of old users table
CREATE TABLE users_backup AS SELECT * FROM users;
```

---

### Step 3: Update Appointments Table

```sql
-- Step 3.1: Rename user_id to patient_id
ALTER TABLE appointments RENAME COLUMN user_id TO patient_id;

-- Step 3.2: Add doctor_id column
ALTER TABLE appointments ADD COLUMN doctor_id UUID REFERENCES clinic_staff(id) ON DELETE RESTRICT;

-- Step 3.3: Add new indexes
CREATE INDEX appointments_patient_idx ON appointments(patient_id);
CREATE INDEX appointments_doctor_idx ON appointments(doctor_id);
CREATE INDEX appointments_patient_scheduled_idx ON appointments(patient_id, scheduled_at);

-- Step 3.4: Drop old composite index if exists
DROP INDEX IF EXISTS appointments_clinic_user_idx;
```

---

### Step 4: Recreate Users Table (Global)

```sql
-- Step 4.1: Drop old users table (data is backed up)
DROP TABLE users CASCADE;

-- Step 4.2: Create new global users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX users_email_unique ON users(email);
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_is_active_idx ON users(is_active);

-- Step 4.3: Restore foreign key for appointments
ALTER TABLE appointments
  ADD CONSTRAINT appointments_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE RESTRICT;
```

---

### Step 5: Migrate Patient Data (If Any)

```sql
-- If you have existing patient data in users_backup that should become global users
-- (This depends on your current data structure)

-- Example: Migrate patients who have appointments
INSERT INTO users (id, name, email, password_hash, phone, is_active, created_at, updated_at)
SELECT DISTINCT
  ub.id,
  ub.name,
  ub.email,
  ub.password_hash,
  NULL as phone,
  ub.is_active,
  ub.created_at,
  ub.updated_at
FROM users_backup ub
INNER JOIN appointments a ON a.patient_id = ub.id
WHERE NOT EXISTS (
  SELECT 1 FROM clinic_staff cs WHERE cs.id = ub.id
)
ON CONFLICT (email) DO NOTHING; -- Skip if email already exists
```

---

### Step 6: Update Refresh Tokens Table

```sql
-- Update refresh_tokens to support both user types
ALTER TABLE refresh_tokens ADD COLUMN user_type VARCHAR(20) DEFAULT 'staff' NOT NULL;

-- Add check constraint
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_user_type_check
  CHECK (user_type IN ('patient', 'staff'));

-- Update existing tokens to 'staff' (they were all clinic staff)
UPDATE refresh_tokens SET user_type = 'staff';
```

---

## 💻 Phase 2: Code Migration

### Step 1: Update Schema Files

1. **Update `api/src/modules/users/user.schema.ts`**
   - Remove `clinicId` field
   - Remove `emailClinicUnique` constraint
   - Add global `emailUnique` constraint

2. **Create `api/src/modules/clinics/clinic.schema.ts`**
   - Add `clinics` table definition
   - Add `clinicStaff` table definition

3. **Update `api/src/modules/appointments/appointment.schema.ts`**
   - Rename `userId` to `patientId`
   - Add `doctorId` field
   - Update references

4. **Update `api/src/db/schema.ts`**
   ```typescript
   export * from "../modules/users/user.schema.js";
   export * from "../modules/clinics/clinic.schema.js"; // NEW
   export * from "../modules/appointments/appointment.schema.js";
   export * from "../modules/auth/auth.schema.js";
   export * from "../modules/rbac/rbac.schema.js";
   ```

---

### Step 2: Create Public Modules

```bash
mkdir -p api/src/modules/public/clinics
mkdir -p api/src/modules/public/doctors
mkdir -p api/src/modules/public/availability
```

Create files for each module:
- `*.controller.ts`
- `*.service.ts`
- `*.repository.ts`
- `*.routes.ts`
- `*.validation.ts`

---

### Step 3: Update Appointment Module

1. **Update `appointment.repository.ts`**
   - Add `findAllForPatient()` method (no clinic filter)
   - Add `findAllForClinic()` method (with clinic filter)
   - Update `findById()` to be context-aware
   - Update all methods to accept context

2. **Update `appointment.service.ts`**
   - Add `userType` to context parameter
   - Implement patient logic (cross-clinic)
   - Implement staff logic (clinic-scoped)
   - Update all methods

3. **Update `appointment.controller.ts`**
   - Extract context from `req.user`
   - Pass context to service methods

---

### Step 4: Update Auth Module

1. **Update JWT generation** to include `userType`:
   ```typescript
   // For patients
   const token = jwt.sign({
     userId: user.id,
     email: user.email,
     userType: "patient",
     permissions: ["appointments:create", "appointments:view_own"],
   }, JWT_SECRET);

   // For staff
   const token = jwt.sign({
     userId: staff.id,
     clinicId: staff.clinicId,
     email: staff.email,
     userType: "staff",
     role: staff.role,
     permissions: staffPermissions,
   }, JWT_SECRET);
   ```

2. **Update auth middleware** to set `userType` on `req.user`

---

### Step 5: Update Routes in server.ts

```typescript
// Public routes (no auth)
app.use("/api/public/clinics", publicClinicRoutes);
app.use("/api/public/doctors", publicDoctorRoutes);
app.use("/api/public/availability", publicAvailabilityRoutes);

// Private routes (auth required)
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
```

---

## 🧪 Phase 3: Testing

### Test 1: Patient Cross-Clinic Appointments

```bash
# Login as patient
POST /api/v1/auth/login
{
  "email": "patient@example.com",
  "password": "password"
}

# Create appointment with Clinic A
POST /api/v1/appointments
{
  "clinicId": "clinic-a-uuid",
  "title": "Checkup",
  "scheduledAt": "2026-04-20T10:00:00Z"
}

# Create appointment with Clinic B
POST /api/v1/appointments
{
  "clinicId": "clinic-b-uuid",
  "title": "Consultation",
  "scheduledAt": "2026-04-21T14:00:00Z"
}

# List all appointments (should see both)
GET /api/v1/appointments
# Expected: Both appointments from Clinic A and B
```

---

### Test 2: Clinic Isolation

```bash
# Login as Clinic A staff
POST /api/v1/auth/login
{
  "email": "doctor@clinica.com",
  "password": "password"
}

# List appointments
GET /api/v1/appointments
# Expected: Only Clinic A appointments

# Try to access Clinic B appointment
GET /api/v1/appointments/{clinic-b-appointment-id}
# Expected: 404 Not Found (isolation working)
```

---

### Test 3: Public Marketplace

```bash
# Browse clinics (no auth)
GET /api/public/clinics
# Expected: List of published clinics

# Get clinic details
GET /api/public/clinics/clinic-a-slug
# Expected: Clinic A details

# Browse doctors
GET /api/public/doctors?clinicId=clinic-a-uuid
# Expected: List of doctors for Clinic A
```

---

## 🔄 Rollback Plan

If migration fails, follow these steps:

### Step 1: Restore Database Backup

```bash
# Stop application
pm2 stop api

# Restore from backup
psql -U postgres -d clinic_db < backup_before_migration.sql

# Restart application
pm2 start api
```

### Step 2: Revert Code Changes

```bash
git checkout main
npm install
npm run build
pm2 restart api
```

---

## ✅ Post-Migration Checklist

- [ ] All tests passing
- [ ] Patient can create appointments with multiple clinics
- [ ] Patient can view all their appointments
- [ ] Clinic staff can only see their clinic's data
- [ ] Public marketplace shows published clinics
- [ ] Authentication works for both patients and staff
- [ ] No data loss (verify record counts)
- [ ] Performance is acceptable (check query times)
- [ ] Logs show no errors
- [ ] Monitoring dashboards updated

---

## 📊 Verification Queries

```sql
-- Check clinic count
SELECT COUNT(*) FROM clinics;

-- Check staff count
SELECT COUNT(*) FROM clinic_staff;

-- Check global users count
SELECT COUNT(*) FROM users;

-- Check appointments have valid references
SELECT COUNT(*) FROM appointments a
LEFT JOIN users u ON a.patient_id = u.id
LEFT JOIN clinics c ON a.clinic_id = c.id
WHERE u.id IS NULL OR c.id IS NULL;
-- Expected: 0 (no orphaned records)

-- Check email uniqueness
SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)

SELECT email, clinic_id, COUNT(*) FROM clinic_staff
GROUP BY email, clinic_id HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates per clinic)
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Duplicate Emails

**Problem:** Patient email conflicts with staff email

**Solution:**
```sql
-- Find conflicts
SELECT u.email, cs.email
FROM users u
INNER JOIN clinic_staff cs ON u.email = cs.email;

-- Resolve by appending clinic ID to staff email
UPDATE clinic_staff
SET email = email || '+' || clinic_id
WHERE email IN (SELECT email FROM users);
```

---

### Issue 2: Orphaned Appointments

**Problem:** Appointments reference non-existent users

**Solution:**
```sql
-- Find orphaned appointments
SELECT a.id, a.patient_id
FROM appointments a
LEFT JOIN users u ON a.patient_id = u.id
WHERE u.id IS NULL;

-- Option 1: Delete orphaned appointments
DELETE FROM appointments
WHERE patient_id NOT IN (SELECT id FROM users);

-- Option 2: Create placeholder users
INSERT INTO users (id, name, email, password_hash, is_active)
SELECT DISTINCT
  a.patient_id,
  'Unknown Patient',
  'unknown+' || a.patient_id || '@example.com',
  'placeholder',
  false
FROM appointments a
LEFT JOIN users u ON a.patient_id = u.id
WHERE u.id IS NULL;
```

---

### Issue 3: Performance Degradation

**Problem:** Queries are slow after migration

**Solution:**
```sql
-- Analyze tables
ANALYZE users;
ANALYZE clinics;
ANALYZE clinic_staff;
ANALYZE appointments;

-- Check missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename IN ('users', 'clinics', 'clinic_staff', 'appointments');

-- Add missing indexes if needed
CREATE INDEX IF NOT EXISTS appointments_patient_scheduled_idx
  ON appointments(patient_id, scheduled_at);
```

---

## 📞 Support

If you encounter issues during migration:

1. **Check logs:** `pm2 logs api`
2. **Check database:** Run verification queries
3. **Rollback if needed:** Follow rollback plan
4. **Contact team:** Escalate to senior engineer

---

**Status:** 📋 Ready for Migration
