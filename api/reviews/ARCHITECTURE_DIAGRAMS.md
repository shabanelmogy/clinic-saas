# 🎨 Architecture Diagrams - Marketplace System

Visual representations of the marketplace architecture.

---

## 📊 Data Model Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        GLOBAL LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐                                           │
│  │     users        │  ← GLOBAL (no clinic_id)                  │
│  ├──────────────────┤                                           │
│  │ id (PK)          │                                           │
│  │ name             │                                           │
│  │ email (UNIQUE)   │  ← Globally unique                       │
│  │ passwordHash     │                                           │
│  │ phone            │                                           │
│  │ isActive         │                                           │
│  └──────────────────┘                                           │
│           │                                                      │
│           │ patient_id (FK)                                     │
│           ▼                                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        TENANT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │    clinics       │         │  clinic_staff    │             │
│  ├──────────────────┤         ├──────────────────┤             │
│  │ id (PK)          │◄────────│ id (PK)          │             │
│  │ name             │ clinic_id│ clinic_id (FK)   │             │
│  │ slug (UNIQUE)    │         │ name             │             │
│  │ description      │         │ email            │             │
│  │ isPublished      │         │ passwordHash     │             │
│  │ isActive         │         │ role             │             │
│  └──────────────────┘         │ specialization   │             │
│           │                    └──────────────────┘             │
│           │ clinic_id (FK)              │ doctor_id (FK)       │
│           ▼                             ▼                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        HYBRID LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────┐                  │
│  │          appointments                     │                  │
│  ├──────────────────────────────────────────┤                  │
│  │ id (PK)                                   │                  │
│  │ patient_id (FK) → users.id               │ ← Global user    │
│  │ clinic_id (FK) → clinics.id              │ ← Tenant         │
│  │ doctor_id (FK) → clinic_staff.id         │ ← Optional       │
│  │ title                                     │                  │
│  │ scheduledAt                               │                  │
│  │ status                                    │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Access Pattern Flow

### Patient Flow (Cross-Clinic)

```
┌─────────────┐
│   Patient   │
│  (Global)   │
└──────┬──────┘
       │
       │ Login once
       ▼
┌─────────────────────────────────────────┐
│  JWT Token                               │
│  {                                       │
│    userId: "uuid",                       │
│    userType: "patient",                  │
│    permissions: [...]                    │
│  }                                       │
└──────┬──────────────────────────────────┘
       │
       │ Can interact with ANY clinic
       ▼
┌──────────────────────────────────────────────────────┐
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Clinic A │  │ Clinic B │  │ Clinic C │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             │             │                  │
│       │ Book        │ Book        │ Book            │
│       ▼             ▼             ▼                  │
│  ┌─────────────────────────────────────┐            │
│  │      Patient's Appointments         │            │
│  ├─────────────────────────────────────┤            │
│  │ • Appointment with Clinic A         │            │
│  │ • Appointment with Clinic B         │            │
│  │ • Appointment with Clinic C         │            │
│  └─────────────────────────────────────┘            │
│                                                       │
│  ✅ Patient sees ALL appointments                    │
│  ✅ No clinic_id filter                              │
└──────────────────────────────────────────────────────┘
```

### Staff Flow (Clinic-Scoped)

```
┌─────────────┐
│ Clinic Staff│
│  (Scoped)   │
└──────┬──────┘
       │
       │ Login to their clinic
       ▼
┌─────────────────────────────────────────┐
│  JWT Token                               │
│  {                                       │
│    userId: "uuid",                       │
│    clinicId: "clinic-a-uuid",           │
│    userType: "staff",                    │
│    role: "doctor",                       │
│    permissions: [...]                    │
│  }                                       │
└──────┬──────────────────────────────────┘
       │
       │ Can ONLY access their clinic
       ▼
┌──────────────────────────────────────────────────────┐
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Clinic A │  │ Clinic B │  │ Clinic C │          │
│  │  (MINE)  │  │ (BLOCKED)│  │ (BLOCKED)│          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             ✗             ✗                  │
│       │ Access      │ No Access   │ No Access       │
│       ▼             ▼             ▼                  │
│  ┌─────────────────────────────────────┐            │
│  │    Clinic A's Appointments          │            │
│  ├─────────────────────────────────────┤            │
│  │ • Patient 1 → Clinic A              │            │
│  │ • Patient 2 → Clinic A              │            │
│  │ • Patient 3 → Clinic A              │            │
│  └─────────────────────────────────────┘            │
│                                                       │
│  ✅ Staff sees ONLY their clinic                     │
│  ✅ ALWAYS filter by clinic_id                       │
└──────────────────────────────────────────────────────┘
```

---

## 🛣️ API Route Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      API ROUTES                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PUBLIC ROUTES (No Authentication)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GET  /api/public/clinics                                   │
│       → List all published clinics                          │
│       → Filter: isPublished = true                          │
│                                                              │
│  GET  /api/public/clinics/:slug                             │
│       → Get clinic details by slug                          │
│       → Filter: isPublished = true                          │
│                                                              │
│  GET  /api/public/doctors?clinicId=xxx                      │
│       → List doctors for a clinic                           │
│       → Filter: clinic_id + isActive = true                 │
│                                                              │
│  GET  /api/public/availability?clinicId=xxx&date=xxx        │
│       → Check availability                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PRIVATE ROUTES (Authentication Required)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  APPOINTMENTS (Context-Aware)                        │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  GET  /api/v1/appointments                            │  │
│  │       Patient: All appointments (no clinic filter)    │  │
│  │       Staff: Only their clinic's appointments         │  │
│  │                                                        │  │
│  │  POST /api/v1/appointments                            │  │
│  │       Patient: Can book with ANY clinic               │  │
│  │       Staff: Can only book for their clinic           │  │
│  │                                                        │  │
│  │  GET  /api/v1/appointments/:id                        │  │
│  │       Patient: Check ownership (patient_id)           │  │
│  │       Staff: Check ownership (clinic_id)              │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  USERS (Patient Profiles)                            │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  GET   /api/v1/users/me                               │  │
│  │        → Get own profile                              │  │
│  │                                                        │  │
│  │  PATCH /api/v1/users/me                               │  │
│  │        → Update own profile                           │  │
│  │                                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Query Pattern Comparison

### Before (Single-Tenant)

```
┌─────────────────────────────────────────────────────────────┐
│  OLD PATTERN (Single-Tenant)                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  users table:                                               │
│  ┌──────────────────────────────────────┐                  │
│  │ id, clinic_id, name, email, ...      │                  │
│  └──────────────────────────────────────┘                  │
│                                                              │
│  Query appointments:                                        │
│  SELECT * FROM appointments                                 │
│  WHERE clinic_id = 'xxx'                                    │
│    AND user_id = 'yyy';                                     │
│                                                              │
│  ❌ Problem: User can't interact with other clinics         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### After (Marketplace)

```
┌─────────────────────────────────────────────────────────────┐
│  NEW PATTERN (Marketplace)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  users table (GLOBAL):                                      │
│  ┌──────────────────────────────────────┐                  │
│  │ id, name, email, ... (NO clinic_id)  │                  │
│  └──────────────────────────────────────┘                  │
│                                                              │
│  appointments table:                                        │
│  ┌──────────────────────────────────────┐                  │
│  │ id, patient_id, clinic_id, ...       │                  │
│  └──────────────────────────────────────┘                  │
│                                                              │
│  Patient query (cross-clinic):                             │
│  SELECT * FROM appointments                                 │
│  WHERE patient_id = 'xxx';                                  │
│  ✅ No clinic_id filter                                     │
│                                                              │
│  Staff query (clinic-scoped):                              │
│  SELECT * FROM appointments                                 │
│  WHERE clinic_id = 'yyy';                                   │
│  ✅ Always filter by clinic_id                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎭 Context-Aware Logic Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Request arrives at /api/v1/appointments                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Auth Middleware                                            │
│  • Verify JWT                                               │
│  • Extract: userId, userType, clinicId, permissions         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller                                                 │
│  • Extract context from req.user                            │
│  • Pass to service                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Service (Context-Aware)                                    │
│                                                              │
│  if (context.userType === "patient") {                      │
│    // Patient logic                                         │
│    return appointmentRepository.findAllForPatient(          │
│      context.userId,                                        │
│      query                                                  │
│    );                                                        │
│  } else {                                                    │
│    // Staff logic                                           │
│    return appointmentRepository.findAllForClinic(           │
│      context.clinicId,                                      │
│      query                                                  │
│    );                                                        │
│  }                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Repository (Dual Access)                                   │
│                                                              │
│  findAllForPatient(patientId, query) {                      │
│    // ✅ No clinic filter                                   │
│    WHERE patient_id = patientId                             │
│  }                                                           │
│                                                              │
│  findAllForClinic(clinicId, query) {                        │
│    // ✅ Always filter by clinic                            │
│    WHERE clinic_id = clinicId                               │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Authentication                                     │
│  • JWT verification                                          │
│  • User identity confirmed                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: User Type Detection                                │
│  • Patient vs Staff identification                           │
│  • Context extraction                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Permission Check                                   │
│  • RBAC permission verification                              │
│  • Action authorization                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Data Access Control                                │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │  Patient Access      │  │  Staff Access        │        │
│  ├──────────────────────┤  ├──────────────────────┤        │
│  │ • Filter by          │  │ • Filter by          │        │
│  │   patient_id         │  │   clinic_id          │        │
│  │ • Cross-clinic       │  │ • Clinic-scoped      │        │
│  │ • Own data only      │  │ • Tenant isolated    │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📈 Scalability Model

```
┌─────────────────────────────────────────────────────────────┐
│                    SCALABILITY                               │
└─────────────────────────────────────────────────────────────┘

Global Users (Patients)
├── User 1 ──┬── Appointment @ Clinic A
│            ├── Appointment @ Clinic B
│            └── Appointment @ Clinic C
│
├── User 2 ──┬── Appointment @ Clinic A
│            └── Appointment @ Clinic D
│
└── User N ──┬── Appointment @ Clinic X
             └── Appointment @ Clinic Y

Clinics (Tenants)
├── Clinic A ──┬── Staff 1, Staff 2, Staff 3
│              ├── Appointments from User 1, User 2
│              └── Isolated data
│
├── Clinic B ──┬── Staff 4, Staff 5
│              ├── Appointments from User 1
│              └── Isolated data
│
└── Clinic N ──┬── Staff X, Staff Y
               ├── Appointments from User N
               └── Isolated data

✅ Benefits:
• Horizontal scaling (add more clinics)
• User growth independent of clinic growth
• Clear data boundaries
• Easy to add new features
```

---

**Status:** ✅ Architecture Documented
