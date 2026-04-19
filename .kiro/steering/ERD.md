# Database ERD — Healthcare SaaS

> Architecture: Multi-Tenant Marketplace · Staff/Patient Separation · Slot-Based Scheduling
> Last updated: 2026-04-19

---

```mermaid
erDiagram

  %% ════════════════════════════════════════════════════════
  %% GLOBAL / SYSTEM
  %% ════════════════════════════════════════════════════════

  staff_users {
    uuid        id              PK
    varchar     name            "NOT NULL"
    varchar     email           "UNIQUE (partial: deleted_at IS NULL)"
    varchar     password_hash   "NOT NULL"
    varchar     phone
    boolean     is_active       "DEFAULT true"
    timestamp   deleted_at      "soft-delete"
    timestamp   created_at
    timestamp   updated_at
  }

  refresh_tokens {
    uuid        id              PK
    uuid        staff_user_id   FK
    varchar     token_hash      "UNIQUE · SHA-256"
    uuid        family_id       "reuse detection"
    timestamp   expires_at      "NOT NULL"
    timestamp   revoked_at      "soft-revoke"
    varchar     user_agent
    varchar     ip_address
    timestamp   created_at
  }

  %% ════════════════════════════════════════════════════════
  %% RBAC  (staff only — no patient roles)
  %% ════════════════════════════════════════════════════════

  roles {
    uuid        id              PK
    varchar     name            "NOT NULL"
    varchar     description
    uuid        clinic_id       "FK nullable · NULL = global role"
    timestamp   created_at
    timestamp   updated_at
  }

  permissions {
    uuid        id              PK
    varchar     key             "UNIQUE · e.g. appointments:create"
    varchar     name            "NOT NULL"
    varchar     description
    varchar     category        "NOT NULL"
    timestamp   created_at
  }

  role_permissions {
    uuid        role_id         PK FK
    uuid        permission_id   PK FK
    timestamp   created_at
  }

  staff_user_roles {
    uuid        id              PK
    uuid        staff_user_id   FK
    uuid        role_id         FK
    uuid        clinic_id       "FK nullable · NULL = global assignment"
    timestamp   assigned_at
    uuid        assigned_by     "FK → staff_users nullable"
  }

  %% ════════════════════════════════════════════════════════
  %% TENANTS
  %% ════════════════════════════════════════════════════════

  clinics {
    uuid        id              PK
    varchar     name            "NOT NULL"
    varchar     slug            "UNIQUE (partial: deleted_at IS NULL)"
    text        description
    text        address
    varchar     phone
    varchar     email
    varchar     website
    varchar     logo
    boolean     is_active       "DEFAULT true"
    boolean     is_published    "DEFAULT false · marketplace visibility"
    timestamp   deleted_at      "soft-delete"
    timestamp   created_at
    timestamp   updated_at
  }

  %% ════════════════════════════════════════════════════════
  %% CLINIC-OWNED ENTITIES
  %% ════════════════════════════════════════════════════════

  patients {
    uuid        id              PK
    uuid        clinic_id       FK "NOT NULL · tenant isolation"
    varchar     name            "NOT NULL"
    varchar     phone
    varchar     email           "UNIQUE per clinic (partial: NOT NULL)"
    date        date_of_birth
    enum        gender          "male | female | other"
    enum        blood_type      "A+ A- B+ B- AB+ AB- O+ O-"
    text        allergies
    text        medical_notes
    varchar     emergency_contact_name
    varchar     emergency_contact_phone
    text        address
    varchar     national_id     "UNIQUE per clinic (partial: NOT NULL)"
    boolean     is_active       "DEFAULT true"
    timestamp   deleted_at      "soft-delete"
    timestamp   created_at
    timestamp   updated_at
  }

  doctors {
    uuid        id              PK
    uuid        clinic_id       FK "NOT NULL · tenant isolation"
    uuid        staff_user_id   FK "nullable · optional login account"
    varchar     name            "NOT NULL"
    enum        specialty       "general_practice | cardiology | ..."
    text        bio
    varchar     avatar
    varchar     phone
    varchar     email
    integer     experience_years "CHECK >= 0 AND <= 70"
    integer     consultation_fee "CHECK >= 0 · cents"
    boolean     is_active       "DEFAULT true"
    boolean     is_published    "DEFAULT true · marketplace visibility"
    timestamp   deleted_at      "soft-delete"
    timestamp   created_at
    timestamp   updated_at
  }

  %% ════════════════════════════════════════════════════════
  %% SCHEDULING
  %% ════════════════════════════════════════════════════════

  doctor_schedules {
    uuid        id              PK
    uuid        clinic_id       FK "NOT NULL · tenant isolation"
    uuid        doctor_id       FK "NOT NULL · CASCADE delete"
    enum        day_of_week     "monday..sunday"
    time        start_time      "NOT NULL · CHECK end > start"
    time        end_time        "NOT NULL"
    smallint    slot_duration_minutes "DEFAULT 30 · CHECK 5-480"
    smallint    max_appointments "DEFAULT 1 · CHECK 1-50"
    boolean     is_active       "DEFAULT true"
    timestamp   created_at
    timestamp   updated_at
  }

  slot_times {
    uuid        id              PK
    uuid        clinic_id       FK "NOT NULL · tenant isolation"
    uuid        doctor_id       FK "NOT NULL · CASCADE delete"
    timestamp   start_time      "NOT NULL · UNIQUE with doctor_id"
    timestamp   end_time        "NOT NULL"
    enum        status          "available | booked | blocked"
    uuid        appointment_id  FK "nullable · SET NULL on cancel"
    timestamp   created_at
  }

  %% ════════════════════════════════════════════════════════
  %% APPOINTMENTS (HYBRID)
  %% ════════════════════════════════════════════════════════

  appointments {
    uuid        id              PK
    uuid        clinic_id       FK "NOT NULL · tenant isolation"
    uuid        patient_id      FK "NOT NULL"
    uuid        doctor_id       FK "nullable · SET NULL"
    varchar     title           "NOT NULL"
    text        description
    timestamp   scheduled_at    "NOT NULL"
    integer     duration_minutes "DEFAULT 60 · CHECK 1-480"
    enum        status          "pending | confirmed | cancelled | completed | no_show"
    text        notes
    timestamp   deleted_at      "soft-delete"
    timestamp   created_at
    timestamp   updated_at
  }

  appointment_history {
    uuid        id              PK
    uuid        appointment_id  FK "NOT NULL · CASCADE delete"
    uuid        clinic_id       FK "NOT NULL"
    enum        previous_status "nullable"
    enum        new_status      "NOT NULL"
    uuid        changed_by      FK "nullable → staff_users"
    text        reason
    timestamp   changed_at      "NOT NULL · append-only"
  }

  %% ════════════════════════════════════════════════════════
  %% RELATIONSHIPS
  %% ════════════════════════════════════════════════════════

  %% Auth
  staff_users         ||--o{  refresh_tokens        : "has sessions (cascade)"
  staff_users         ||--o{  staff_user_roles       : "assigned roles"
  staff_users         ||--o{  staff_user_roles       : "assigned_by"
  staff_users         ||--o{  appointment_history    : "changed_by"

  %% RBAC
  roles               ||--o{  role_permissions       : "has permissions"
  roles               ||--o{  staff_user_roles       : "assigned to staff"
  permissions         ||--o{  role_permissions       : "belongs to roles"
  clinics             ||--o{  roles                  : "clinic-specific roles"
  clinics             ||--o{  staff_user_roles       : "scoped assignments"

  %% Clinic owns everything below
  clinics             ||--o{  patients               : "owns (restrict)"
  clinics             ||--o{  doctors                : "employs (restrict)"
  clinics             ||--o{  doctor_schedules       : "owns (restrict)"
  clinics             ||--o{  slot_times             : "owns (restrict)"
  clinics             ||--o{  appointments           : "receives (restrict)"
  clinics             ||--o{  appointment_history    : "audit (restrict)"

  %% Doctor optional login
  staff_users         |o--o{  doctors                : "optional login (set null)"

  %% Scheduling chain
  doctors             ||--o{  doctor_schedules       : "has rules (cascade)"
  doctors             ||--o{  slot_times             : "has slots (cascade)"
  doctor_schedules    }o--||  doctors                : "generates slots for"

  %% Slot ↔ Appointment
  slot_times          |o--o|  appointments           : "linked when booked (set null)"

  %% Appointments
  patients            ||--o{  appointments           : "books (restrict)"
  doctors             |o--o{  appointments           : "assigned to (set null)"
  appointments        ||--o{  appointment_history    : "audit trail (cascade)"
```

---

## Table Summary

| Table | Type | Rows | Key Constraints |
|---|---|---|---|
| `staff_users` | Global | ~100s | email UNIQUE (partial), soft-delete |
| `refresh_tokens` | System | ~1000s | token_hash UNIQUE, CASCADE on staff delete |
| `roles` | RBAC | ~10s | Two partial uniques for NULL-safe global/clinic names |
| `permissions` | RBAC | ~30 fixed | key UNIQUE, seeded at startup |
| `role_permissions` | RBAC junction | ~100s | Composite PK |
| `staff_user_roles` | RBAC junction | ~100s | Two partial uniques for NULL-safe global/clinic assignments |
| `clinics` | Tenant | ~100s | slug UNIQUE (partial), soft-delete |
| `patients` | Clinic-owned | ~millions | email+clinic UNIQUE (partial), nationalId+clinic UNIQUE (partial), soft-delete |
| `doctors` | Clinic-owned | ~1000s | staffUserId+clinic UNIQUE (partial), CHECK on fee/experience, soft-delete |
| `doctor_schedules` | Config | ~7 per doctor | UNIQUE (doctorId, dayOfWeek), CHECK time order + bounds |
| `slot_times` | Generated | ~millions | UNIQUE (doctorId, startTime), no soft-delete |
| `appointments` | Hybrid | ~millions | UNIQUE (doctorId, scheduledAt, clinicId) partial, CHECK duration, soft-delete |
| `appointment_history` | Audit | ~millions | Append-only, composite index on (appointmentId, changedAt) |

---

## Scheduling Flow

```
doctor_schedules (rules)
        │
        │  background job (daily/weekly)
        ▼
   slot_times (generated slots)
        │
        │  booking: UPDATE status='booked', appointment_id=?
        │           WHERE status='available'  ← atomic, race-safe
        ▼
   appointments (business record)
        │
        │  status change
        ▼
   appointment_history (immutable audit)
```

---

## Multi-Tenant Isolation Rules

- Every clinic-owned table has `clinic_id NOT NULL`
- Every query on clinic-owned data starts with `WHERE clinic_id = ?`
- `patients.email` is unique **per clinic** — same person can be patient at two clinics
- `doctors.staff_user_id` links to a global `staff_users` row — one login, multiple clinic roles via `staff_user_roles`
- `roles.clinic_id = NULL` → global role · `roles.clinic_id = UUID` → clinic-specific role
- Soft-deleted records (`deleted_at IS NOT NULL`) are excluded from all active queries via partial indexes

---

## Enums

| Enum | Values |
|---|---|
| `appointment_status` | `pending` · `confirmed` · `cancelled` · `completed` · `no_show` |
| `slot_status` | `available` · `booked` · `blocked` |
| `day_of_week` | `monday` · `tuesday` · `wednesday` · `thursday` · `friday` · `saturday` · `sunday` |
| `doctor_specialty` | `general_practice` · `cardiology` · `dermatology` · `endocrinology` · `gastroenterology` · `gynecology` · `hematology` · `nephrology` · `neurology` · `oncology` · `ophthalmology` · `orthopedics` · `otolaryngology` · `pediatrics` · `psychiatry` · `pulmonology` · `radiology` · `rheumatology` · `surgery` · `urology` · `other` |
| `patient_gender` | `male` · `female` · `other` |
| `patient_blood_type` | `A+` · `A-` · `B+` · `B-` · `AB+` · `AB-` · `O+` · `O-` |
