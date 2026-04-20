---
inclusion: manual
---

# Frontend Build Plan — Healthcare SaaS Dashboard

> Generated: 2026-04-20  
> Based on: `api/src/modules/` full audit + existing `web/` state  
> Stack: Next.js 16 App Router · shadcn/ui · React Query · Zustand · Axios · next-intl

---

## Current State Summary

### ✅ Already Built (working)

| Module | Pages | Feature Layer | Notes |
|---|---|---|---|
| Auth | login | — | JWT + cookie guard |
| Dashboard | `/dashboard` | — | Static stats cards (no real data) |
| Patients | `/patients`, `/patients/[id]`, `/patients/[id]/edit` | api + hooks + types + components | Full CRUD |
| Doctors | `/doctors`, `/doctors/[id]`, `/doctors/[id]/edit` | api + hooks + types | Full CRUD + schedules + generate slots |
| Appointments | `/appointments`, `/appointments/[id]` | api + hooks + types | List + detail + history timeline |
| Requests | `/requests` (tabbed) | api + hooks + types + components | Patient + doctor requests, approve/reject |
| Clinics | `/clinics` | api + hooks + types | Read-only marketplace list |
| Staff Users | `/staff-users` | api + hooks + types | List + create + delete |
| Roles | `/roles` | api + hooks + types | Two-panel RBAC editor |

### ❌ Missing / Incomplete

| Gap | Priority | Effort |
|---|---|---|
| Dashboard real stats (live counts) | HIGH | S |
| Staff user detail + edit page | HIGH | S |
| Clinic detail + edit page (for clinic admin) | HIGH | M |
| Slot times management page | HIGH | M |
| Patient appointments tab on patient detail | MEDIUM | S |
| Staff user role assignment on user detail | MEDIUM | S |
| Auth: change password page | MEDIUM | S |
| Auth: logout-all button | LOW | XS |
| Patients: `[id]/edit` page exists but needs verification | MEDIUM | XS |
| Doctors: `[id]/edit` page exists but needs verification | MEDIUM | XS |
| Requests: doctor request detail (clinicName for create type) | LOW | XS |

---

## API Endpoint Inventory

### Auth (`/api/v1/auth`)
| Method | Endpoint | Frontend Status |
|---|---|---|
| POST | `/login` | ✅ Done |
| POST | `/refresh` | ✅ Done (interceptor) |
| POST | `/logout` | ✅ Done |
| POST | `/logout-all` | ❌ Missing |
| GET | `/me` | ❌ Not used |
| POST | `/change-password` | ❌ Missing page |

### Patients (`/api/v1/patients`)
| Method | Endpoint | Frontend Status |
|---|---|---|
| GET | `/` | ✅ Done |
| GET | `/:id` | ✅ Done |
| POST | `/` | ✅ Done |
| PATCH | `/:id` | ✅ Done |
| DELETE | `/:id` | ✅ Done |

### Doctors (`/api/v1/doctors`)
| Method | Endpoint | Frontend Status |
|---|---|---|
| GET | `/` | ✅ Done |
| GET | `/:id` | ✅ Done |
| POST | `/` | ✅ Done |
| PATCH | `/:id` | ✅ Done |
| DELETE | `/:id` | ✅ Done |
| GET | `/:doctorId/schedules` | ✅ Done |
| PUT | `/:doctorId/schedules` | ✅ Done |
| DELETE | `/:doctorId/schedules/:day` | ✅ Done |

### Appointments (`/api/v1/appointments`)
| Method | Endpoint | Frontend Status |
|---|---|---|
| GET | `/enriched` | ✅ Done |
| GET | `/:id/enriched` | ✅ Done |
| GET | `/:id/history` | ✅ Done |
| POST | `/` | ✅ Done |
| PATCH | `/:id` | ✅ Done |
| DELETE | `/:id` | ✅ Done |
| POST | `/:id/cancel` | ✅ Done |

### Slot Times (`/api/v1/slot-times`)
| Method | Endpoint | Frontend Status |
|---|---|---|
| GET | `/` | ❌ Missing page |
| POST | `/generate` | ✅ Done (from doctor detail) |
| POST | `/:id/book` | ❌ Not exposed in UI |
| POST | `/:id/release` | ❌ Not exposed in UI |
| PATCH | `/:id/status` | ❌ Missing (block/unblock) |

### Clinics (`/api/v1/clinics`)
| Method | Endpoint | Frontend Status |
|---|---|---|
| GET | `/` | ✅ Done (marketplace list) |
| GET | `/me` | ❌ Not used in edit page |
| PATCH | `/me` | ❌ Missing edit page |
| GET | `/:id` | ❌ Not used |

### Staff Users (`/api/v1/staff-users`)
| Method | Endpoint | Frontend Status |
|---|---|---|
| GET | `/` | ✅ Done |
| GET | `/:id` | ❌ Missing detail page |
| POST | `/` | ✅ Done |
| PATCH | `/:id` | ❌ Missing edit |
| DELETE | `/:id` | ✅ Done |

### Roles (`/api/v1/roles`)
| Method | Endpoint | Frontend Status |
|---|---|---|
| GET | `/permissions` | ✅ Done |
| GET | `/` | ✅ Done |
| GET | `/:id` | ✅ Done |
| POST | `/` | ✅ Done |
| PATCH | `/:id` | ✅ Done |
| DELETE | `/:id` | ✅ Done |
| POST | `/assign` | ✅ Done |
| POST | `/unassign` | ❌ Missing (unassign from user detail) |

### Patient Requests (`/api/v1/patient-requests`)
| Method | Endpoint | Frontend Status |
|---|---|---|
| GET | `/` | ✅ Done |
| POST | `/:id/approve` | ✅ Done |
| POST | `/:id/reject` | ✅ Done |
| PATCH | `/:id/assign-clinic` | ❌ Removed (correct — patients are global) |

### Doctor Requests (`/api/v1/doctor-requests`)
| Method | Endpoint | Frontend Status |
|---|---|---|
| GET | `/` | ✅ Done |
| POST | `/:id/approve` | ✅ Done |
| POST | `/:id/reject` | ✅ Done |

---

## Build Tasks (Prioritized)

---

### ✅ TASK 1 — Dashboard Live Stats _(DONE)_
**Priority:** HIGH | **Effort:** S  
**Page:** `/dashboard`  
**What:** Replace `"—"` placeholder values with real counts from API.

**Implementation:**
- Call `GET /patients?limit=1` → use `meta.total` for patient count
- Call `GET /appointments?limit=1` → use `meta.total` for appointment count  
- Call `GET /patient-requests?status=pending&limit=1` → pending requests count
- Call `GET /doctors?limit=1` → doctor count (clinic staff only)
- Show loading skeletons while fetching
- Add quick-link buttons on each card → navigate to the respective page

**Files to create/edit:**
- `web/app/[locale]/(protected)/dashboard/page.tsx` — add real data hooks

---

### ✅ TASK 2 — Staff User Detail + Edit _(DONE)_
**Priority:** HIGH | **Effort:** S  
**Pages:** `/staff-users/[id]`, `/staff-users/[id]/edit`  
**What:** View staff user profile, edit name/email/phone/isActive, manage assigned roles.

**Implementation:**
- `GET /staff-users/:id` → display profile card
- `PATCH /staff-users/:id` → edit form (name, email, phone, isActive toggle)
- Show assigned roles (from JWT context or a roles list)
- `POST /roles/assign` + `POST /roles/unassign` → role management on detail page
- Add "View" action to staff-users table dropdown

**Files to create:**
- `web/app/[locale]/(protected)/staff-users/[id]/page.tsx`
- `web/app/[locale]/(protected)/staff-users/[id]/edit/page.tsx`

**Feature layer additions:**
- Add `getById`, `update` to `web/features/staff-users/api/staff-users.api.ts`
- Add `useStaffUser`, `useUpdateStaffUser` to hooks
- Add `UpdateStaffUserInput` to types

---

### TASK 3 — Clinic Settings Page (Clinic Admin)
**Priority:** HIGH | **Effort:** M  
**Page:** `/clinics/me`  
**What:** Clinic staff can view and edit their own clinic settings.

**Implementation:**
- `GET /clinics/me` → display clinic info
- `PATCH /clinics/me` → edit form (name, description, address, phone, email, website, isPublished toggle)
- Show in sidebar for clinic-scoped users (replace generic "Clinics" link)
- Super admin keeps the marketplace list at `/clinics`

**Files to create:**
- `web/app/[locale]/(protected)/clinics/me/page.tsx`

**Feature layer additions:**
- Add `getMe`, `updateMe` to `web/features/clinics/api/clinics.api.ts`
- Add `useMyClinic`, `useUpdateMyClinic` to hooks
- Add `UpdateClinicInput` to types

**Sidebar change:**
- Clinic staff: show "My Clinic" → `/clinics/me`
- Super admin: show "Clinics" → `/clinics` (marketplace list)

---

### TASK 4 — Slot Times Management Page
**Priority:** HIGH | **Effort:** M  
**Page:** `/slots`  
**What:** View, filter, block/unblock slots for the clinic's doctors.

**Implementation:**
- `GET /slot-times?clinicId=...&doctorId=...&from=...&to=...` → paginated slot list
- Filter by: doctor (dropdown), status (available/booked/blocked), date range
- `PATCH /slot-times/:id/status` → block/unblock available slots
- Color-coded status: green=available, blue=booked, red=blocked
- Show slot start time, end time, doctor name, status

**Files to create:**
- `web/app/[locale]/(protected)/slots/page.tsx`
- `web/features/slot-times/api/slot-times.api.ts`
- `web/features/slot-times/hooks/use-slot-times.ts`
- `web/features/slot-times/types/slot-time.types.ts`

**Sidebar:** Add "Slots" nav item (clinicOnly: true, icon: CalendarClock)

---

### TASK 5 — Patient Appointments Tab
**Priority:** MEDIUM | **Effort:** S  
**Page:** `/patients/[id]` (add tab)  
**What:** Show all appointments for a specific patient on their detail page.

**Implementation:**
- Add a "Appointments" tab to the patient detail page
- `GET /appointments/enriched?patientId=:id` → list appointments for this patient
- Show: title, scheduled date, status badge, doctor name
- Click row → navigate to `/appointments/:id`

**Files to edit:**
- `web/app/[locale]/(protected)/patients/[id]/page.tsx` — add Tabs + appointments tab

---

### TASK 6 — Staff User Role Management on Detail Page
**Priority:** MEDIUM | **Effort:** S  
**Page:** `/staff-users/[id]` (part of Task 2)  
**What:** View and manage roles assigned to a staff user.

**Implementation:**
- Show current roles as badges
- "Assign Role" button → dropdown/dialog to pick from available roles
- "Remove" button next to each role → `POST /roles/unassign`
- Add `useUnassignRole` hook to `web/features/rbac/hooks/use-rbac.ts`

---

### TASK 7 — Change Password Page
**Priority:** MEDIUM | **Effort:** S  
**Page:** `/settings/security` or accessible from topbar user menu  
**What:** Allow staff to change their own password.

**Implementation:**
- Form: currentPassword, newPassword, confirmNewPassword
- `POST /auth/change-password` → on success, show toast + redirect to login (all sessions revoked)
- Add to user dropdown in topbar

**Files to create:**
- `web/app/[locale]/(protected)/settings/page.tsx`

**Feature layer additions:**
- Add `changePassword` to `web/features/auth/api/auth.api.ts` (or inline in page)

---

### TASK 8 — Logout All Devices
**Priority:** LOW | **Effort:** XS  
**Location:** Topbar user dropdown  
**What:** "Sign out all devices" button.

**Implementation:**
- `POST /auth/logout-all` → clear local auth state → redirect to login
- Add to topbar dropdown menu alongside existing logout

---

## File Structure After All Tasks

```
web/
├── app/[locale]/(protected)/
│   ├── dashboard/page.tsx          ← TASK 1: live stats
│   ├── patients/
│   │   ├── page.tsx                ✅ done
│   │   └── [id]/
│   │       ├── page.tsx            ← TASK 5: add appointments tab
│   │       └── edit/page.tsx       ✅ done
│   ├── doctors/
│   │   ├── page.tsx                ✅ done
│   │   └── [id]/
│   │       ├── page.tsx            ✅ done
│   │       └── edit/page.tsx       ✅ done
│   ├── appointments/
│   │   ├── page.tsx                ✅ done
│   │   └── [id]/page.tsx           ✅ done
│   ├── slots/
│   │   └── page.tsx                ← TASK 4: new
│   ├── requests/page.tsx           ✅ done
│   ├── clinics/
│   │   ├── page.tsx                ✅ done (super admin)
│   │   └── me/page.tsx             ← TASK 3: new
│   ├── staff-users/
│   │   ├── page.tsx                ✅ done
│   │   └── [id]/
│   │       ├── page.tsx            ← TASK 2: new
│   │       └── edit/page.tsx       ← TASK 2: new
│   ├── roles/page.tsx              ✅ done
│   └── settings/page.tsx           ← TASK 7: new
│
└── features/
    ├── appointments/               ✅ done
    ├── clinics/                    ← TASK 3: add getMe/updateMe
    ├── doctors/                    ✅ done
    ├── patients/                   ✅ done
    ├── rbac/                       ← TASK 6: add unassignRole
    ├── requests/                   ✅ done
    ├── slot-times/                 ← TASK 4: new feature folder
    │   ├── api/slot-times.api.ts
    │   ├── hooks/use-slot-times.ts
    │   └── types/slot-time.types.ts
    └── staff-users/                ← TASK 2: add getById/update
```

---

## Sidebar Navigation After All Tasks

```typescript
const NAV_ITEMS = [
  // Always visible
  { key: "dashboard",    href: "dashboard"   },
  { key: "requests",     href: "requests"    },
  { key: "patients",     href: "patients"    },
  { key: "appointments", href: "appointments" },

  // Clinic staff only
  { key: "doctors",      href: "doctors",      clinicOnly: true },
  { key: "slots",        href: "slots",        clinicOnly: true },   // ← NEW
  { key: "myClinic",     href: "clinics/me",   clinicOnly: true },   // ← NEW

  // Super admin only
  { key: "clinics",      href: "clinics",      superAdminOnly: true },
  { key: "staffUsers",   href: "staff-users",  superAdminOnly: true },
  { key: "roles",        href: "roles",        superAdminOnly: true },
];
```

---

## Component Patterns to Follow

All pages follow this consistent pattern:

```
Page
├── Header (title + description + action button)
├── Filters row (search, selects, date pickers)
├── Table or Card grid (with skeleton loading)
├── Pagination
└── Dialogs (create, edit, delete confirm)
```

### API layer pattern
```typescript
// features/<name>/api/<name>.api.ts
export const <name>Api = {
  list: async (params?) => { ... },
  getById: async (id) => { ... },
  create: async (input) => { ... },
  update: async (id, input) => { ... },
  delete: async (id) => { ... },
};
```

### Hook pattern
```typescript
// features/<name>/hooks/use-<name>.ts
export function use<Name>s(params?) { return useQuery(...) }
export function use<Name>(id) { return useQuery(...) }
export function useCreate<Name>() { return useMutation(...) }
export function useUpdate<Name>(id) { return useMutation(...) }
export function useDelete<Name>() { return useMutation(...) }
```

### Key rules
- All mutations: `onSuccess` → `qc.invalidateQueries` + `toast.success`
- All mutations: `onError` → `toast.error(getErrorMessage(e))`
- List pages: always use `meta.total`, `meta.totalPages`, `meta.hasNextPage`, `meta.hasPrevPage`
- Detail pages: `isLoading` → skeleton, `!data` → "not found" message
- Forms: controlled state, `required` on mandatory fields, `disabled={mutation.isPending}`
- Dialogs: `onOpenChange` closes on outside click, `Back` button for cancel

---

## Permissions Reference (for UI guards)

```typescript
// Read from useAuthStore(s => s.user)
const user = useAuthStore(s => s.user);
const isGlobal = !user?.clinicId;  // Super Admin

// Permission checks (from JWT — no DB call)
user?.permissions.includes("patients:create")
user?.permissions.includes("doctors:update")
user?.permissions.includes("slots:manage")
user?.permissions.includes("clinic:update")
user?.permissions.includes("users:manage_roles")
```

---

## Slot Time Types Reference

```typescript
// For TASK 4
type SlotStatus = "available" | "booked" | "blocked";

type SlotTime = {
  id: string;
  clinicId: string;
  doctorId: string;
  startTime: string;   // ISO datetime
  endTime: string;     // ISO datetime
  status: SlotStatus;
  appointmentId: string | null;
  createdAt: string;
};

type ListSlotTimesParams = {
  page?: number;
  limit?: number;
  clinicId?: string;
  doctorId?: string;
  status?: SlotStatus;
  from?: string;
  to?: string;
};
```

---

## Execution Order

Build in this order to maximize value and minimize rework:

1. **TASK 1** — Dashboard stats (quick win, high visibility)
2. **TASK 3** — Clinic settings (clinic admins need this)
3. **TASK 4** — Slot times page (core scheduling feature)
4. **TASK 2** — Staff user detail + edit + role management
5. **TASK 5** — Patient appointments tab (enhances existing page)
6. **TASK 7** — Change password (security feature)
7. **TASK 8** — Logout all (trivial, low priority)
8. **TASK 6** — Covered by Task 2

---

*This document is the single source of truth for frontend build tasks.*  
*Update status column as tasks complete.*
